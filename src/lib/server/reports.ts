import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { cairoDayStart } from "./summary";

export interface DayPoint {
  key: string; // YYYY-MM-DD (Cairo)
  orders: number; // not cancelled
  delivered: number;
  cancelled: number;
  revenue: number; // delivered orders only
}

export interface Report {
  days: number;
  from: string;
  totals: { orders: number; delivered: number; cancelled: number; revenue: number; avgOrder: number; inProgress: number };
  daily: DayPoint[];
  weekly: DayPoint[]; // key = first day of the week (Saturday)
  topItems: { name: string; unit: "piece" | "kg"; qty: number; revenue: number }[];
  split: { restaurant: number; butcher: number };
}

const num = (v: unknown) => Number(v);
const r2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(d);

/** Egypt's week starts on Saturday. Returns the Saturday on or before the given YYYY-MM-DD. */
export function weekStart(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  const back = (d.getUTCDay() + 1) % 7; // Sat=0 ... Fri=6
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function getReport(days: number, now = new Date()): Promise<Report> {
  const db = createSupabaseAdmin();
  const start = cairoDayStart(new Date(now.getTime() - (days - 1) * 86_400_000));

  const orders = await fetchAll<{ id: string; status: string; created_at: string; total_estimate: number; total_final: number | null }>((a, b) =>
    db.from("orders").select("id, status, created_at, total_estimate, total_final").gte("created_at", start.toISOString()).order("created_at").range(a, b),
  );

  const live = orders.filter((o) => o.status !== "cancelled");
  const deliveredIds = new Set(live.filter((o) => o.status === "delivered").map((o) => o.id));
  const liveIds = live.map((o) => o.id);

  const lines: { order_id: string; kind: "restaurant" | "butcher"; name_snapshot: string; unit: "piece" | "kg"; qty_requested: number; qty_final: number | null; line_total_estimate: number; line_total_final: number | null }[] = [];
  for (let i = 0; i < liveIds.length; i += 200) {
    const chunk = liveIds.slice(i, i + 200);
    lines.push(
      ...(await fetchAll((a, b) =>
        db.from("order_items").select("order_id, kind, name_snapshot, unit, qty_requested, qty_final, line_total_estimate, line_total_final").in("order_id", chunk).range(a, b),
      )),
    );
  }

  // every day in the range appears, even with zero orders
  const daily = new Map<string, DayPoint>();
  for (let i = 0; i < days; i++) {
    const key = dayKey(new Date(start.getTime() + i * 86_400_000 + 12 * 3_600_000));
    daily.set(key, { key, orders: 0, delivered: 0, cancelled: 0, revenue: 0 });
  }
  const value = (o: { total_estimate: unknown; total_final: unknown }) => num(o.total_final ?? o.total_estimate);
  for (const o of orders) {
    const p = daily.get(dayKey(new Date(o.created_at)));
    if (!p) continue;
    if (o.status === "cancelled") p.cancelled++;
    else {
      p.orders++;
      if (o.status === "delivered") {
        p.delivered++;
        p.revenue += value(o);
      }
    }
  }

  const weekly = new Map<string, DayPoint>();
  for (const p of daily.values()) {
    const k = weekStart(p.key);
    const w = weekly.get(k) ?? { key: k, orders: 0, delivered: 0, cancelled: 0, revenue: 0 };
    w.orders += p.orders; w.delivered += p.delivered; w.cancelled += p.cancelled; w.revenue += p.revenue;
    weekly.set(k, w);
  }

  const top = new Map<string, { name: string; unit: "piece" | "kg"; qty: number; revenue: number }>();
  const split = { restaurant: 0, butcher: 0 };
  for (const l of lines) {
    const v = num(l.line_total_final ?? l.line_total_estimate);
    const t = top.get(l.name_snapshot) ?? { name: l.name_snapshot, unit: l.unit, qty: 0, revenue: 0 };
    t.qty += num(l.qty_final ?? l.qty_requested);
    t.revenue += v;
    top.set(l.name_snapshot, t);
    if (deliveredIds.has(l.order_id)) split[l.kind] += v;
  }

  const round = (p: DayPoint) => ({ ...p, revenue: r2(p.revenue) });
  const revenue = r2([...daily.values()].reduce((s, p) => s + p.revenue, 0));
  const deliveredN = deliveredIds.size;
  return {
    days,
    from: dayKey(start),
    totals: {
      orders: live.length,
      delivered: deliveredN,
      cancelled: orders.length - live.length,
      revenue,
      avgOrder: deliveredN ? r2(revenue / deliveredN) : 0,
      inProgress: live.length - deliveredN,
    },
    daily: [...daily.values()].map(round),
    weekly: [...weekly.values()].map(round),
    topItems: [...top.values()].map((t) => ({ ...t, qty: Math.round(t.qty * 100) / 100, revenue: r2(t.revenue) })).sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    split: { restaurant: r2(split.restaurant), butcher: r2(split.butcher) },
  };
}

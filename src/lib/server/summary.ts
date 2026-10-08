import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export interface DailySummary {
  date: string;
  orders: number; // not cancelled
  cancelled: number;
  delivered: number;
  revenue: number; // delivered orders: final total, or estimate when nothing was weighed
  pending: number; // estimated value of orders still in progress
  restaurantRevenue: number;
  butcherRevenue: number;
  topItems: { name: string; unit: "piece" | "kg"; qty: number; revenue: number }[];
}

/** UTC instant of 00:00 today in Cairo (handles the +2/+3 daylight saving switch). */
export function cairoDayStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const localAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(g("year"), g("month") - 1, g("day")) - offset);
}

const num = (v: unknown) => Number(v);
const r2 = (n: number) => Math.round(n * 100) / 100;

export async function getDailySummary(now = new Date()): Promise<DailySummary> {
  const since = cairoDayStart(now).toISOString();
  const db = createSupabaseAdmin();
  // Orders and their lines in parallel (lines are filtered through their order).
  const [{ data: orders }, { data: lines }] = await Promise.all([
    db.from("orders").select("id, status, total_estimate, total_final").gte("created_at", since),
    db
      .from("order_items")
      .select("order_id, kind, name_snapshot, unit, qty_requested, qty_final, line_total_estimate, line_total_final, orders!inner(created_at, status)")
      .gte("orders.created_at", since)
      .neq("orders.status", "cancelled"),
  ]);
  const live = (orders ?? []).filter((o) => o.status !== "cancelled");

  const deliveredIds = new Set(live.filter((o) => o.status === "delivered").map((o) => o.id));
  const top = new Map<string, { name: string; unit: "piece" | "kg"; qty: number; revenue: number }>();
  let restaurantRevenue = 0;
  let butcherRevenue = 0;
  for (const l of lines ?? []) {
    const lineValue = num(l.line_total_final ?? l.line_total_estimate);
    const qty = num(l.qty_final ?? l.qty_requested);
    const t = top.get(l.name_snapshot) ?? { name: l.name_snapshot, unit: l.unit, qty: 0, revenue: 0 };
    t.qty += qty;
    t.revenue += lineValue;
    top.set(l.name_snapshot, t);
    if (deliveredIds.has(l.order_id)) {
      if (l.kind === "butcher") butcherRevenue += lineValue;
      else restaurantRevenue += lineValue;
    }
  }

  const value = (o: { total_estimate: unknown; total_final: unknown }) => num(o.total_final ?? o.total_estimate);
  return {
    date: new Intl.DateTimeFormat("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "full" }).format(now),
    orders: live.length,
    cancelled: (orders ?? []).length - live.length,
    delivered: deliveredIds.size,
    revenue: r2(live.filter((o) => o.status === "delivered").reduce((s, o) => s + value(o), 0)),
    pending: r2(live.filter((o) => o.status !== "delivered").reduce((s, o) => s + value(o), 0)),
    restaurantRevenue: r2(restaurantRevenue),
    butcherRevenue: r2(butcherRevenue),
    topItems: [...top.values()]
      .map((t) => ({ ...t, qty: Math.round(t.qty * 100) / 100, revenue: r2(t.revenue) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5),
  };
}

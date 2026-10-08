import "server-only";
import { createHash, randomInt } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getOpenState } from "@/lib/hours";
import {
  computeOrder,
  OrderError,
  type InputLine,
  type OrderTotals,
  type PricingItem,
  type PricingOffer,
  type PricingZone,
} from "@/lib/pricing/order";
import type { OrderInput } from "@/lib/validation/order";
import { normalizeThreshold, type SiteSettings } from "@/lib/types";

const admin = () => createSupabaseAdmin();
const num = (v: unknown) => Number(v);

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Salted hash so raw IPs never sit in the rate limit table. */
export const hashKey = (v: string) =>
  createHash("sha256").update(`${process.env.RATE_LIMIT_SALT ?? ""}:${v}`).digest("hex").slice(0, 32);

/** Throws 429 when the bucket is over its limit. Fails closed if the limiter itself is down. */
export async function limit(key: string, max: number, windowSeconds: number) {
  const { data, error } = await admin().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) throw new ApiError(503, "limiter_down", "في مشكلة مؤقتة. جرب كمان شوية.");
  if (data !== true) throw new ApiError(429, "rate_limited", "طلبات كتير في وقت قصير. استنى شوية وجرب تاني.");
}

interface PricingContext {
  items: Map<string, PricingItem>;
  offers: PricingOffer[];
  zone: PricingZone | null;
  settings: SiteSettings;
}

/** Reads everything needed to price a cart from the database (service role: we filter ourselves). */
async function loadContext(lines: InputLine[], zoneId: string | null | undefined): Promise<PricingContext> {
  const db = admin();
  const ids = [...new Set(lines.map((l) => l.itemId))];

  const [itemsRes, offersRes, settingsRes, zoneRes] = await Promise.all([
    db
      .from("items")
      .select("id, name_ar, unit, base_price, min_qty, step_qty, available, active, category_id, categories!inner(type, active), item_variants(*), item_extras(*)")
      .in("id", ids),
    db.from("offers").select("*").eq("active", true),
    db.from("settings").select("key, value"),
    zoneId ? db.from("delivery_zones").select("id, name_ar, fee, min_order, active").eq("id", zoneId).maybeSingle() : null,
  ]);
  if (itemsRes.error || offersRes.error || settingsRes.error || zoneRes?.error) {
    throw new ApiError(500, "db_error", "حصلت مشكلة. جرب تاني بعد شوية.");
  }

  const items = new Map<string, PricingItem>();
  for (const r of itemsRes.data as any[]) {
    if (!r.active || !r.categories?.active) continue; // hidden items cannot be ordered
    items.set(r.id, {
      id: r.id,
      name_ar: r.name_ar,
      unit: r.unit,
      kind: r.categories.type,
      category_id: r.category_id,
      base_price: num(r.base_price),
      min_qty: num(r.min_qty),
      step_qty: num(r.step_qty),
      available: r.available,
      variants: (r.item_variants ?? []).map((v: any) => ({ ...v, price_delta: num(v.price_delta) })),
      extras: (r.item_extras ?? []).map((e: any) => ({ ...e, price: num(e.price) })),
    });
  }

  const offers: PricingOffer[] = (offersRes.data as any[]).map((o) => ({ ...o, discount_value: num(o.discount_value) }));
  const settings = Object.fromEntries(settingsRes.data!.map((r) => [r.key, r.value])) as unknown as SiteSettings;

  let zone: PricingZone | null = null;
  if (zoneId) {
    const z = zoneRes!.data as any;
    if (!z || !z.active) throw new ApiError(409, "zone_unavailable", "المنطقة دي مش متاحة للتوصيل دلوقتي. اختار منطقة تانية.", { zoneId: "منطقة مش متاحة" });
    zone = { id: z.id, name_ar: z.name_ar, fee: num(z.fee), min_order: num(z.min_order) };
  }
  return { items, offers, zone, settings };
}

export interface Quote {
  totals: OrderTotals;
  open: boolean;
  canOrder: boolean;
  settings: SiteSettings;
}

export async function buildQuote(input: {
  lines: InputLine[];
  fulfillment: "delivery" | "pickup";
  zoneId?: string | null;
}): Promise<Quote> {
  const ctx = await loadContext(input.lines, input.fulfillment === "delivery" ? input.zoneId : null);
  let totals: OrderTotals;
  try {
    totals = computeOrder({
      lines: input.lines,
      items: ctx.items,
      offers: ctx.offers,
      fulfillment: input.fulfillment,
      zone: ctx.zone,
      freeDeliveryThreshold: normalizeThreshold(ctx.settings.free_delivery_threshold),
    });
  } catch (e) {
    if (e instanceof OrderError) throw new ApiError(422, e.code, e.message);
    throw e;
  }
  const open = getOpenState(ctx.settings).open;
  return { totals, open, canOrder: open || ctx.settings.accept_orders_when_closed === true, settings: ctx.settings };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const makeCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

export interface CreatedOrder {
  code: string;
  total: number;
  itemCount: number;
  fulfillment: "delivery" | "pickup";
  hasButcher: boolean;
}

export async function createOrder(input: OrderInput): Promise<CreatedOrder> {
  const quote = await buildQuote(input);
  if (!quote.canOrder) {
    throw new ApiError(403, "closed", "المطعم مقفول دلوقتي. هنستقبل طلبك أول ما نفتح.");
  }
  const t = quote.totals;
  const db = admin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    const { data: order, error } = await db
      .from("orders")
      .insert({
        code,
        customer_name: input.name,
        phone: input.phone,
        fulfillment: input.fulfillment,
        zone_id: t.zone?.id ?? null,
        zone_name: t.zone?.name_ar ?? null,
        address_json: input.fulfillment === "delivery" ? input.address : null,
        notes: input.notes || null,
        payment_method: input.payment,
        has_butcher: t.hasButcher,
        has_restaurant: t.hasRestaurant,
        subtotal_estimate: t.subtotal,
        delivery_fee: t.deliveryFee,
        discount_total: t.discountTotal,
        total_estimate: t.total,
        status: "new",
      })
      .select("id, code")
      .single();

    if (error?.code === "23505") continue; // code collision: try another
    if (error || !order) throw new ApiError(500, "db_error", "مقدرناش نسجل الطلب. جرب تاني.");

    const rows = t.lines.map((l) => ({
      order_id: order.id,
      item_id: l.itemId,
      kind: l.kind,
      name_snapshot: l.name,
      unit: l.unit,
      qty_requested: l.qty,
      unit_price_snapshot: l.unitPrice,
      variant_snapshot: { variant: l.variant, extras: l.extras, discount: l.discount, offers: l.offerTitles },
      line_total_estimate: l.lineTotal,
    }));
    const [itemsRes, eventRes] = await Promise.all([
      db.from("order_items").insert(rows),
      db.from("order_events").insert({ order_id: order.id, status: "new", note: "تم استلام الطلب من الموقع" }),
    ]);
    if (itemsRes.error || eventRes.error) {
      await db.from("orders").delete().eq("id", order.id); // never leave a half-saved order behind
      throw new ApiError(500, "db_error", "مقدرناش نسجل الطلب. جرب تاني.");
    }
    return {
      code: order.code,
      total: t.total,
      itemCount: t.lines.length,
      fulfillment: input.fulfillment,
      hasButcher: t.hasButcher,
    };
  }
  throw new ApiError(500, "code_collision", "حصلت مشكلة. جرب تاني.");
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

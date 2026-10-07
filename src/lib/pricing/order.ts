import type { CategoryType, Extra, ItemUnit, Variant } from "../types";

/**
 * Order totals. Pure and deterministic: the server feeds it rows read from the database,
 * never numbers sent by the browser. All arithmetic is in integer cents.
 *
 * Offer rules (documented here because money logic must be predictable):
 *  - Only offers that are active and inside their date window count.
 *  - Item/category offers: each cart line gets at most ONE offer, the one that saves the most.
 *    A fixed amount applies once per line (not per unit) and never exceeds the line total.
 *  - Cart offers: at most ONE, the best one, applied to the subtotal after line discounts.
 *    It is shared out across lines in proportion to their net amount.
 *  - Free delivery uses the goods total after discounts. Pickup never pays a fee.
 */

export type OrderErrorCode =
  | "empty_cart"
  | "item_unavailable"
  | "bad_variant"
  | "bad_extra"
  | "bad_qty"
  | "zone_required"
  | "zone_unavailable"
  | "below_min_order";

export class OrderError extends Error {
  constructor(
    public code: OrderErrorCode,
    message: string,
    public meta?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export interface PricingItem {
  id: string;
  name_ar: string;
  unit: ItemUnit;
  kind: CategoryType;
  category_id: string;
  base_price: number;
  min_qty: number;
  step_qty: number;
  available: boolean;
  variants: Variant[];
  extras: Extra[];
}

export interface PricingOffer {
  id: string;
  title_ar: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  target_type: "item" | "category" | "cart";
  target_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

export interface PricingZone {
  id: string;
  name_ar: string;
  fee: number;
  min_order: number;
}

export interface InputLine {
  itemId: string;
  variantId?: string | null;
  extraIds?: string[];
  qty: number;
}

export interface PricedLine {
  itemId: string;
  name: string;
  kind: CategoryType;
  unit: ItemUnit;
  qty: number;
  unitPrice: number;
  variant: { id: string; name: string } | null;
  extras: { id: string; name: string; price: number }[];
  lineTotal: number;
  /** Line offer + this line's share of any cart offer. */
  discount: number;
  offerTitles: string[];
}

export interface OrderTotals {
  lines: PricedLine[];
  subtotal: number;
  lineDiscounts: number;
  cartDiscount: number;
  discountTotal: number;
  goodsTotal: number;
  deliveryFee: number;
  freeDelivery: boolean;
  total: number;
  hasButcher: boolean;
  hasRestaurant: boolean;
  zone: PricingZone | null;
}

export interface ComputeInput {
  lines: InputLine[];
  items: Map<string, PricingItem>;
  offers: PricingOffer[];
  fulfillment: "delivery" | "pickup";
  zone: PricingZone | null;
  freeDeliveryThreshold: number | null;
  now?: Date;
}

const cents = (v: number) => Math.round(v * 100);
const fromCents = (c: number) => c / 100;
const EPS = 1e-6;

export function isValidQty(item: Pick<PricingItem, "min_qty" | "step_qty" | "unit">, qty: number): boolean {
  if (!Number.isFinite(qty) || qty < item.min_qty - EPS) return false;
  const max = item.unit === "kg" ? 20 : 50;
  if (qty > max + EPS) return false;
  const steps = (qty - item.min_qty) / item.step_qty;
  return Math.abs(steps - Math.round(steps)) < 1e-4;
}

function offerLive(o: PricingOffer, now: Date): boolean {
  if (!o.active) return false;
  if (o.starts_at && new Date(o.starts_at) > now) return false;
  if (o.ends_at && new Date(o.ends_at) < now) return false;
  return true;
}

function discountCents(o: PricingOffer, baseCents: number): number {
  const raw = o.discount_type === "percent" ? Math.round((baseCents * o.discount_value) / 100) : cents(o.discount_value);
  return Math.min(Math.max(raw, 0), baseCents);
}

export function computeOrder(input: ComputeInput): OrderTotals {
  const { lines, items, offers, fulfillment, zone, freeDeliveryThreshold } = input;
  const now = input.now ?? new Date();
  if (lines.length === 0) throw new OrderError("empty_cart", "الصينية فاضية.");

  const live = offers.filter((o) => offerLive(o, now));
  const priced: (PricedLine & { baseCents: number; lineDiscCents: number })[] = [];

  for (const l of lines) {
    const item = items.get(l.itemId);
    if (!item || !item.available) {
      throw new OrderError("item_unavailable", `${item?.name_ar ?? "صنف"} مش متاح دلوقتي.`, { itemId: l.itemId });
    }
    if (!isValidQty(item, l.qty)) {
      throw new OrderError("bad_qty", `الكمية المطلوبة من ${item.name_ar} مش مظبوطة.`, { itemId: l.itemId });
    }

    let variant: Variant | null = null;
    if (item.variants.length > 0) {
      variant = item.variants.find((v) => v.id === l.variantId) ?? null;
      if (!variant) throw new OrderError("bad_variant", `اختار حجم ${item.name_ar}.`, { itemId: l.itemId });
    } else if (l.variantId) {
      throw new OrderError("bad_variant", `${item.name_ar} ملوش أحجام.`, { itemId: l.itemId });
    }

    const extraIds = [...new Set(l.extraIds ?? [])];
    const extras = extraIds.map((id) => item.extras.find((e) => e.id === id));
    if (extras.some((e) => !e)) throw new OrderError("bad_extra", `إضافة مش موجودة على ${item.name_ar}.`, { itemId: l.itemId });
    const chosen = extras as Extra[];

    const unitCents =
      cents(item.base_price) + cents(variant?.price_delta ?? 0) + chosen.reduce((s, e) => s + cents(e.price), 0);
    const baseCents = Math.round(unitCents * l.qty);

    // best single item/category offer for this line
    let best: { o: PricingOffer; c: number } | null = null;
    for (const o of live) {
      const hit =
        (o.target_type === "item" && o.target_id === item.id) ||
        (o.target_type === "category" && o.target_id === item.category_id);
      if (!hit) continue;
      const c = discountCents(o, baseCents);
      if (c > 0 && (!best || c > best.c)) best = { o, c };
    }

    priced.push({
      itemId: item.id,
      name: item.name_ar,
      kind: item.kind,
      unit: item.unit,
      qty: l.qty,
      unitPrice: fromCents(unitCents),
      variant: variant ? { id: variant.id, name: variant.name_ar } : null,
      extras: chosen.map((e) => ({ id: e.id, name: e.name_ar, price: e.price })),
      lineTotal: fromCents(baseCents),
      discount: 0,
      offerTitles: best ? [best.o.title_ar] : [],
      baseCents,
      lineDiscCents: best?.c ?? 0,
    });
  }

  const subtotalC = priced.reduce((s, l) => s + l.baseCents, 0);
  const lineDiscC = priced.reduce((s, l) => s + l.lineDiscCents, 0);
  const afterLinesC = subtotalC - lineDiscC;

  // best single cart-level offer, on the amount left after line offers
  let cartBest: { o: PricingOffer; c: number } | null = null;
  for (const o of live) {
    if (o.target_type !== "cart") continue;
    const c = discountCents(o, afterLinesC);
    if (c > 0 && (!cartBest || c > cartBest.c)) cartBest = { o, c };
  }
  const cartDiscC = cartBest?.c ?? 0;

  // share the cart discount across lines by net amount; the last line takes the rounding remainder
  let allocated = 0;
  priced.forEach((l, i) => {
    const net = l.baseCents - l.lineDiscCents;
    const share =
      i === priced.length - 1 ? cartDiscC - allocated : afterLinesC === 0 ? 0 : Math.round((cartDiscC * net) / afterLinesC);
    allocated += share;
    l.discount = fromCents(l.lineDiscCents + share);
    if (cartBest && share > 0) l.offerTitles.push(cartBest.o.title_ar);
  });

  const goodsC = afterLinesC - cartDiscC;
  const goodsTotal = fromCents(goodsC);

  let deliveryFee = 0;
  let freeDelivery = false;
  let usedZone: PricingZone | null = null;
  if (fulfillment === "delivery") {
    if (!zone) throw new OrderError("zone_required", "اختار منطقة التوصيل.");
    usedZone = zone;
    if (zone.min_order > 0 && goodsTotal < zone.min_order) {
      throw new OrderError("below_min_order", `الحد الأدنى للطلب في ${zone.name_ar} هو ${zone.min_order} ج.م.`, {
        minOrder: zone.min_order,
      });
    }
    if (freeDeliveryThreshold !== null && goodsTotal >= freeDeliveryThreshold) {
      freeDelivery = true;
    } else {
      deliveryFee = zone.fee;
    }
  }

  const items_ = priced.map(({ baseCents: _b, lineDiscCents: _d, ...rest }) => rest);
  return {
    lines: items_,
    subtotal: fromCents(subtotalC),
    lineDiscounts: fromCents(lineDiscC),
    cartDiscount: fromCents(cartDiscC),
    discountTotal: fromCents(lineDiscC + cartDiscC),
    goodsTotal,
    deliveryFee,
    freeDelivery,
    total: fromCents(goodsC + cents(deliveryFee)),
    hasButcher: items_.some((l) => l.kind === "butcher"),
    hasRestaurant: items_.some((l) => l.kind === "restaurant"),
    zone: usedZone,
  };
}

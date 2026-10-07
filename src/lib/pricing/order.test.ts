import { describe, expect, it } from "vitest";
import { computeOrder, isValidQty, OrderError, type PricingItem, type PricingOffer, type PricingZone } from "./order";

const mandi: PricingItem = {
  id: "mandi", name_ar: "مندي لحم", unit: "piece", kind: "restaurant", category_id: "cat-mandi",
  base_price: 250, min_qty: 1, step_qty: 1, available: true,
  variants: [
    { id: "s", name_ar: "صغير", price_delta: 0, sort: 1 },
    { id: "l", name_ar: "كبير", price_delta: 180, sort: 2 },
  ],
  extras: [
    { id: "yog", name_ar: "سلطة زبادي", price: 15, sort: 1 },
    { id: "drink", name_ar: "مشروب", price: 15.5, sort: 2 },
  ],
};
const kandoz: PricingItem = {
  id: "kandoz", name_ar: "لحم كندوز", unit: "kg", kind: "butcher", category_id: "cat-meat",
  base_price: 420, min_qty: 0.5, step_qty: 0.5, available: true, variants: [], extras: [],
};
const burger: PricingItem = { ...kandoz, id: "burger", name_ar: "برجر", category_id: "cat-proc", base_price: 399.99 };

const items = new Map([mandi, kandoz, burger].map((i) => [i.id, i]));
const zone: PricingZone = { id: "z", name_ar: "منطقة ١", fee: 20, min_order: 100 };

const offer = (o: Partial<PricingOffer>): PricingOffer => ({
  id: "o", title_ar: "عرض", discount_type: "percent", discount_value: 10, target_type: "cart", target_id: null,
  starts_at: null, ends_at: null, active: true, ...o,
});

const base = { items, offers: [] as PricingOffer[], fulfillment: "delivery" as const, zone, freeDeliveryThreshold: null };

describe("computeOrder: prices", () => {
  it("adds variant and extras, multiplies by quantity", () => {
    const r = computeOrder({ ...base, lines: [{ itemId: "mandi", variantId: "l", extraIds: ["yog", "drink"], qty: 2 }] });
    // (250 + 180 + 15 + 15.5) * 2 = 921
    expect(r.lines[0].unitPrice).toBe(460.5);
    expect(r.subtotal).toBe(921);
    expect(r.total).toBe(941); // + 20 delivery
  });

  it("prices butcher items by weight, as an estimate", () => {
    const r = computeOrder({ ...base, lines: [{ itemId: "kandoz", qty: 1.5 }] });
    expect(r.subtotal).toBe(630);
    expect(r.hasButcher).toBe(true);
    expect(r.hasRestaurant).toBe(false);
  });

  it("has no floating point drift", () => {
    const r = computeOrder({ ...base, lines: [{ itemId: "burger", qty: 0.5 }, { itemId: "burger", qty: 1 }] });
    expect(r.subtotal).toBe(599.99); // 200.00 (199.995 rounded to cents) + 399.99
  });

  it("mixed cart is flagged for both boards", () => {
    const r = computeOrder({ ...base, lines: [{ itemId: "mandi", variantId: "s", qty: 1 }, { itemId: "kandoz", qty: 1 }] });
    expect(r.hasButcher && r.hasRestaurant).toBe(true);
  });
});

describe("computeOrder: validation", () => {
  const run = (line: Parameters<typeof computeOrder>[0]["lines"][number]) => () => computeOrder({ ...base, lines: [line] });
  it("rejects empty cart", () => expect(() => computeOrder({ ...base, lines: [] })).toThrow(OrderError));
  it("rejects unknown and unavailable items", () => {
    expect(run({ itemId: "nope", qty: 1 })).toThrow(/مش متاح/);
    const off = new Map(items).set("mandi", { ...mandi, available: false });
    expect(() => computeOrder({ ...base, items: off, lines: [{ itemId: "mandi", variantId: "s", qty: 1 }] })).toThrow(/مش متاح/);
  });
  it("requires a valid variant when the item has sizes", () => {
    expect(run({ itemId: "mandi", qty: 1 })).toThrow(/اختار حجم/);
    expect(run({ itemId: "mandi", variantId: "xx", qty: 1 })).toThrow(OrderError);
    expect(run({ itemId: "kandoz", variantId: "s", qty: 1 })).toThrow(OrderError);
  });
  it("rejects extras that belong to nothing", () => {
    expect(run({ itemId: "mandi", variantId: "s", extraIds: ["ghost"], qty: 1 })).toThrow(/إضافة/);
  });
  it("enforces min, step and max quantity", () => {
    expect(isValidQty(kandoz, 0.5)).toBe(true);
    expect(isValidQty(kandoz, 0.25)).toBe(false);
    expect(isValidQty(kandoz, 1.3)).toBe(false);
    expect(isValidQty(kandoz, 20)).toBe(true);
    expect(isValidQty(kandoz, 20.5)).toBe(false);
    expect(isValidQty(mandi, 0)).toBe(false);
    expect(isValidQty(mandi, -1)).toBe(false);
    expect(isValidQty(mandi, 1.5)).toBe(false);
    expect(isValidQty(mandi, 51)).toBe(false);
    expect(isValidQty(mandi, Number.NaN)).toBe(false);
  });
});

describe("computeOrder: offers", () => {
  const line = [{ itemId: "mandi", variantId: "s", qty: 2 }]; // 500

  it("applies a percent category offer", () => {
    const r = computeOrder({ ...base, lines: line, offers: [offer({ target_type: "category", target_id: "cat-mandi" })] });
    expect(r.discountTotal).toBe(50);
    expect(r.goodsTotal).toBe(450);
    expect(r.lines[0].offerTitles).toEqual(["عرض"]);
  });
  it("applies an item offer only to that item", () => {
    const r = computeOrder({
      ...base,
      lines: [...line, { itemId: "kandoz", qty: 1 }], // 500 + 420
      offers: [offer({ target_type: "item", target_id: "kandoz", discount_type: "fixed", discount_value: 30 })],
    });
    expect(r.discountTotal).toBe(30);
    expect(r.lines[0].discount).toBe(0);
    expect(r.lines[1].discount).toBe(30);
  });
  it("caps a fixed discount at the line total", () => {
    const r = computeOrder({
      ...base, fulfillment: "pickup", zone: null,
      lines: [{ itemId: "kandoz", qty: 0.5 }], // 210
      offers: [offer({ target_type: "item", target_id: "kandoz", discount_type: "fixed", discount_value: 999 })],
    });
    expect(r.goodsTotal).toBe(0);
  });
  it("picks the best single line offer, never stacking two on one line", () => {
    const r = computeOrder({
      ...base, lines: line,
      offers: [
        offer({ id: "a", title_ar: "A", target_type: "item", target_id: "mandi", discount_value: 10 }), // 50
        offer({ id: "b", title_ar: "B", target_type: "category", target_id: "cat-mandi", discount_value: 20 }), // 100
      ],
    });
    expect(r.discountTotal).toBe(100);
    expect(r.lines[0].offerTitles).toEqual(["B"]);
  });
  it("applies the best cart offer after line offers and splits it across lines", () => {
    const r = computeOrder({
      ...base,
      lines: [...line, { itemId: "kandoz", qty: 1 }], // 500 + 420 = 920
      offers: [
        offer({ id: "l", target_type: "item", target_id: "mandi", discount_value: 10 }), // -50 -> 870
        offer({ id: "c1", title_ar: "كارت ١٠٪", discount_value: 10 }), // 87
        offer({ id: "c2", title_ar: "كارت ٣٠ ثابت", discount_type: "fixed", discount_value: 30 }),
      ],
    });
    expect(r.lineDiscounts).toBe(50);
    expect(r.cartDiscount).toBe(87);
    expect(r.discountTotal).toBe(137);
    expect(r.lines.reduce((s, l) => s + l.discount, 0)).toBeCloseTo(137, 10);
    expect(r.goodsTotal).toBe(783);
  });
  it("ignores inactive, expired and not-yet-started offers", () => {
    const now = new Date("2026-10-07T12:00:00Z");
    const mk = (p: Partial<PricingOffer>) => computeOrder({ ...base, now, lines: line, offers: [offer(p)] }).discountTotal;
    expect(mk({ active: false })).toBe(0);
    expect(mk({ ends_at: "2026-10-01T00:00:00Z" })).toBe(0);
    expect(mk({ starts_at: "2026-10-09T00:00:00Z" })).toBe(0);
    expect(mk({ starts_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-30T00:00:00Z" })).toBe(50);
  });
});

describe("computeOrder: delivery", () => {
  const line = [{ itemId: "mandi", variantId: "s", qty: 1 }]; // 250

  it("charges the zone fee", () => {
    const r = computeOrder({ ...base, lines: line });
    expect(r.deliveryFee).toBe(20);
    expect(r.total).toBe(270);
    expect(r.zone?.id).toBe("z");
  });
  it("pickup pays no fee and needs no zone", () => {
    const r = computeOrder({ ...base, fulfillment: "pickup", zone: null, lines: line });
    expect(r.deliveryFee).toBe(0);
    expect(r.total).toBe(250);
  });
  it("delivery requires a zone", () => {
    expect(() => computeOrder({ ...base, zone: null, lines: line })).toThrow(/منطقة/);
  });
  it("enforces the zone minimum on the discounted goods total", () => {
    const strict = { ...zone, min_order: 240 };
    expect(computeOrder({ ...base, zone: strict, lines: line }).goodsTotal).toBe(250);
    expect(() =>
      computeOrder({ ...base, zone: strict, lines: line, offers: [offer({ discount_value: 10 })] }), // 225 < 240
    ).toThrow(OrderError);
  });
  it("free delivery at or above the threshold, judged after discounts", () => {
    const at = computeOrder({ ...base, lines: line, freeDeliveryThreshold: 250 });
    expect(at.freeDelivery).toBe(true);
    expect(at.total).toBe(250);
    const below = computeOrder({ ...base, lines: line, freeDeliveryThreshold: 250, offers: [offer({ discount_value: 10 })] });
    expect(below.freeDelivery).toBe(false);
    expect(below.total).toBe(245); // 225 + 20
  });
});

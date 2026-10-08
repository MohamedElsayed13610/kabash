import { describe, expect, it } from "vitest";
import { itemFields, offerFields, settingSchemas, zoneFields } from "./admin";
import { normalizeThreshold } from "../types";

const uuid = "00000000-0000-4000-8000-000000000001";
const item = { category_id: uuid, name_ar: "مندي", description_ar: null, unit: "piece", base_price: 100, min_qty: 1, step_qty: 1, serving_tag: null, image_url: null, available: true, active: true, featured: false, is_sample: false };

describe("item validation", () => {
  it("accepts a normal item and a per-kg item with half-kilo steps", () => {
    expect(itemFields.safeParse(item).success).toBe(true);
    expect(itemFields.safeParse({ ...item, unit: "kg", min_qty: 0.5, step_qty: 0.5 }).success).toBe(true);
  });
  it("rejects fractional quantities for per-piece items", () => {
    expect(itemFields.safeParse({ ...item, min_qty: 0.5, step_qty: 0.5 }).success).toBe(false);
  });
  it("rejects negative and absurd prices and too-short names", () => {
    expect(itemFields.safeParse({ ...item, base_price: -1 }).success).toBe(false);
    expect(itemFields.safeParse({ ...item, base_price: 1_000_000 }).success).toBe(false);
    expect(itemFields.safeParse({ ...item, name_ar: "ا" }).success).toBe(false);
  });
  it("only accepts images from our own storage bucket", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(itemFields.safeParse({ ...item, image_url: "https://evil.example/x.png" }).success).toBe(false);
    expect(itemFields.safeParse({ ...item, image_url: "https://abc.supabase.co/storage/v1/object/public/menu/items/a.webp" }).success).toBe(true);
  });
});

describe("offer validation", () => {
  const offer = { title_ar: "عرض", discount_type: "percent", discount_value: 10, target_type: "cart", active: true, is_sample: false };
  it("accepts a cart offer and requires a target for item/category offers", () => {
    expect(offerFields.safeParse(offer).success).toBe(true);
    expect(offerFields.safeParse({ ...offer, target_type: "item" }).success).toBe(false);
    expect(offerFields.safeParse({ ...offer, target_type: "item", target_id: uuid }).success).toBe(true);
  });
  it("caps percent at 100 and checks the date order", () => {
    expect(offerFields.safeParse({ ...offer, discount_value: 101 }).success).toBe(false);
    expect(offerFields.safeParse({ ...offer, discount_type: "fixed", discount_value: 500 }).success).toBe(true);
    expect(offerFields.safeParse({ ...offer, starts_at: "2026-10-10T10:00:00Z", ends_at: "2026-10-09T10:00:00Z" }).success).toBe(false);
  });
});

describe("zone and settings validation", () => {
  it("zones: no negative fees, ETA at least 1 minute", () => {
    const z = { name_ar: "منطقة", fee: 10, min_order: 0, active: true, is_sample: false };
    expect(zoneFields.safeParse(z).success).toBe(true);
    expect(zoneFields.safeParse({ ...z, fee: -1 }).success).toBe(false);
    expect(zoneFields.safeParse({ ...z, eta_minutes: 0 }).success).toBe(false);
  });
  it("phone and WhatsApp formats", () => {
    const base = { name_ar: "كباش", address_ar: "بني مزار", phone: "01012345678", whatsapp: "201012345678", social: { facebook: "", instagram: "" } };
    const s = settingSchemas.restaurant_info;
    expect(s.safeParse(base).success).toBe(true);
    expect(s.safeParse({ ...base, phone: "123" }).success).toBe(false);
    expect(s.safeParse({ ...base, whatsapp: "01012345678" }).success).toBe(false);
    expect(s.safeParse({ ...base, social: { facebook: "http://x.example", instagram: "" } }).success).toBe(false);
  });
  it("opening hours need 7 valid days", () => {
    const day = (d: number) => ({ day: d, open: "12:00", close: "01:00", closed: false });
    const week = [0, 1, 2, 3, 4, 5, 6].map(day);
    expect(settingSchemas.opening_hours.safeParse({ timezone: "Africa/Cairo", days: week }).success).toBe(true);
    expect(settingSchemas.opening_hours.safeParse({ timezone: "Africa/Cairo", days: week.slice(1) }).success).toBe(false);
    expect(settingSchemas.opening_hours.safeParse({ timezone: "Africa/Cairo", days: week.map((d, i) => (i === 0 ? { ...d, open: "25:00" } : d)) }).success).toBe(false);
  });
});

describe("free delivery threshold", () => {
  it("null and 0 both mean off; negatives are refused", () => {
    expect(settingSchemas.free_delivery_threshold.safeParse(null).success).toBe(true);
    expect(settingSchemas.free_delivery_threshold.safeParse(0).success).toBe(true);
    expect(settingSchemas.free_delivery_threshold.safeParse(250).success).toBe(true);
    expect(settingSchemas.free_delivery_threshold.safeParse(-5).success).toBe(false);
  });
  it("normalizeThreshold treats anything not positive as off", () => {
    expect(normalizeThreshold(250)).toBe(250);
    for (const v of [0, null, undefined, -1, "100", Number.NaN]) expect(normalizeThreshold(v)).toBeNull();
  });
});

export type CategoryType = "restaurant" | "butcher";
export type ItemUnit = "piece" | "kg";

export interface Variant {
  id: string;
  name_ar: string;
  price_delta: number;
  sort: number;
}

export interface Extra {
  id: string;
  name_ar: string;
  price: number;
  sort: number;
}

export interface Item {
  id: string;
  category_id: string;
  name_ar: string;
  description_ar: string | null;
  unit: ItemUnit;
  base_price: number;
  min_qty: number;
  step_qty: number;
  serving_tag: string | null;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  sort: number;
  is_sample: boolean;
  item_variants: Variant[];
  item_extras: Extra[];
}

export interface Category {
  id: string;
  type: CategoryType;
  name_ar: string;
  sort: number;
  items: Item[];
}

export interface Offer {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  target_type: "item" | "category" | "cart";
  target_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

export interface DaySchedule {
  day: number; // 0 = Sunday
  open: string; // "HH:mm"
  close: string; // "HH:mm", may be earlier than open (after midnight)
  closed: boolean;
}

export interface SiteSettings {
  restaurant_info: {
    name_ar: string;
    address_ar: string;
    phone: string;
    whatsapp: string;
    social: { facebook?: string; instagram?: string };
  };
  opening_hours: { timezone: string; days: DaySchedule[] };
  open_override: "auto" | "open" | "closed";
  accept_orders_when_closed: boolean;
  free_delivery_threshold: number | null;
  announcement_ar: string;
}

/** The free-delivery threshold as stored: a positive number, or anything else (null / 0 / missing) meaning "off". */
export function normalizeThreshold(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

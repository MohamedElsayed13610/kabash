export interface AdminVariant { id: string; name_ar: string; price_delta: number; sort: number }
export interface AdminExtra { id: string; name_ar: string; price: number; sort: number }

export interface AdminItem {
  id: string;
  category_id: string;
  name_ar: string;
  description_ar: string | null;
  unit: "piece" | "kg";
  base_price: number;
  min_qty: number;
  step_qty: number;
  serving_tag: string | null;
  image_url: string | null;
  active: boolean;
  available: boolean;
  featured: boolean;
  sort: number;
  is_sample: boolean;
  item_variants: AdminVariant[];
  item_extras: AdminExtra[];
}

export interface AdminCategory {
  id: string;
  type: "restaurant" | "butcher";
  name_ar: string;
  sort: number;
  active: boolean;
  is_sample: boolean;
  items: AdminItem[];
}

export interface AdminOffer {
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
  active: boolean;
  is_sample: boolean;
}

export interface AdminZone {
  id: string;
  name_ar: string;
  fee: number;
  min_order: number;
  eta_minutes: number | null;
  sort: number;
  active: boolean;
  is_sample: boolean;
}

/** "2026-10-08T14:30" typed in the admin (Cairo time) <-> ISO instant. */
export function cairoLocalToIso(local: string): string | null {
  if (!local) return null;
  const [d, t] = local.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = (t ?? "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, h, min);
  // find Cairo's offset at that moment (+2 or +3) and subtract it
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(guess));
  const cairoHour = Number(parts.find((p) => p.type === "hour")!.value);
  let offset = cairoHour - new Date(guess).getUTCHours();
  if (offset < 0) offset += 24;
  return new Date(guess - offset * 3_600_000).toISOString();
}

export function isoToCairoLocal(iso: string | null): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Africa/Cairo",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso));
  return p.replace(" ", "T");
}

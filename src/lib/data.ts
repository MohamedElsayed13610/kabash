import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { timedFetch } from "./timed-fetch";
import type { Category, CategoryType, Item, Offer, SiteSettings } from "./types";

/**
 * PUBLIC data only (menu, offers, delivery zones, public settings).
 *
 * Each query goes through Next's server cache under a tag. The admin API routes call revalidatePublic(), which
 * expires these tags immediately, so a change in the admin shows on the site on the very next request. The timer
 * below is only a safety net (for example an offer whose end date passes, or a direct edit in the Supabase dashboard).
 *
 * Nothing per-customer or per-staff may ever be read through here: orders, tracking, checkout totals, the admin
 * and staff pages all use uncached clients and stay dynamic. Prices are re-read from the database when an order is placed.
 */
export const PUBLIC_TAGS = ["menu", "offers", "zones", "settings"] as const;
export type PublicTag = (typeof PUBLIC_TAGS)[number];
const SAFETY_NET_SECONDS = 300;

const publicDb = (tag: PublicTag) =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => timedFetch(input, { ...init, cache: "force-cache", next: { tags: [tag], revalidate: SAFETY_NET_SECONDS } }),
    },
  });

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;
const num = (v: unknown) => Number(v);

const ITEM_COLUMNS =
  "id, category_id, name_ar, description_ar, unit, base_price, min_qty, step_qty, serving_tag, image_url, available, featured, sort, is_sample";

/**
 * The whole public menu, both kinds, in four small parallel queries merged in memory.
 * cache() makes every page and helper in one render share a single result.
 */
export const getCatalog = cache(async (): Promise<Category[]> => {
  const db = publicDb("menu");
  const [cats, items, variants, extras] = await Promise.all([
    db.from("categories").select("id, type, name_ar, sort").order("sort"),
    db.from("items").select(ITEM_COLUMNS).order("sort"),
    db.from("item_variants").select("id, item_id, name_ar, price_delta, sort"),
    db.from("item_extras").select("id, item_id, name_ar, price, sort"),
  ]);
  for (const r of [cats, items, variants, extras]) if (r.error) throw new Error(`menu: ${r.error.message}`);

  const variantsBy = new Map<string, Item["item_variants"]>();
  for (const v of variants.data ?? []) {
    const l = variantsBy.get(v.item_id) ?? [];
    l.push({ id: v.id, name_ar: v.name_ar, price_delta: num(v.price_delta), sort: v.sort });
    variantsBy.set(v.item_id, l);
  }
  const extrasBy = new Map<string, Item["item_extras"]>();
  for (const e of extras.data ?? []) {
    const l = extrasBy.get(e.item_id) ?? [];
    l.push({ id: e.id, name_ar: e.name_ar, price: num(e.price), sort: e.sort });
    extrasBy.set(e.item_id, l);
  }
  const itemsBy = new Map<string, Item[]>();
  for (const i of items.data ?? []) {
    const l = itemsBy.get(i.category_id) ?? [];
    l.push({
      ...(i as unknown as Item),
      base_price: num(i.base_price),
      min_qty: num(i.min_qty),
      step_qty: num(i.step_qty),
      item_variants: (variantsBy.get(i.id) ?? []).sort(bySort),
      item_extras: (extrasBy.get(i.id) ?? []).sort(bySort),
    });
    itemsBy.set(i.category_id, l);
  }
  return (cats.data ?? [])
    .map((c) => ({ ...(c as unknown as Category), items: (itemsBy.get(c.id) ?? []).sort(bySort) }))
    .filter((c) => c.items.length > 0)
    .sort(bySort);
});

export async function getMenu(type: CategoryType): Promise<Category[]> {
  return (await getCatalog()).filter((c) => c.type === type);
}

export async function getFeatured(type: CategoryType, limit = 4): Promise<Item[]> {
  const all = (await getMenu(type)).flatMap((c) => c.items);
  const featured = all.filter((i) => i.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export const getOffers = cache(async (): Promise<Offer[]> => {
  const { data, error } = await publicDb("offers")
    .from("offers")
    .select("id, title_ar, description_ar, image_url, discount_type, discount_value, target_type, target_id, starts_at, ends_at")
    .order("discount_value", { ascending: false });
  if (error) throw new Error(`offers: ${error.message}`);
  return (data as Offer[]).map((o) => ({ ...o, discount_value: num(o.discount_value) }));
});

export const getSettings = cache(async (): Promise<SiteSettings> => {
  const { data, error } = await publicDb("settings").from("settings").select("key, value");
  if (error) throw new Error(`settings: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as unknown as SiteSettings;
});

export interface PublicZone {
  id: string;
  name_ar: string;
  fee: number;
  min_order: number;
  eta_minutes: number | null;
}

export const getZones = cache(async (): Promise<PublicZone[]> => {
  const { data, error } = await publicDb("zones")
    .from("delivery_zones")
    .select("id, name_ar, fee, min_order, eta_minutes")
    .eq("active", true)
    .order("sort");
  if (error) throw new Error(`zones: ${error.message}`);
  return (data ?? []).map((z) => ({ ...z, fee: num(z.fee), min_order: num(z.min_order) }));
});

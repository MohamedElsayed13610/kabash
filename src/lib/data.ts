import { createClient } from "@supabase/supabase-js";
import { timedFetch } from "./timed-fetch";
import type { Category, CategoryType, Item, Offer, SiteSettings } from "./types";

// Public, cookie-free client: lets pages be statically rendered and revalidated.
// RLS guarantees it only ever sees active menu data.
const db = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { fetch: timedFetch },
  });

const bySort = <T extends { sort: number }>(a: T, b: T) => a.sort - b.sort;

const num = (v: unknown) => Number(v);

function normalizeItem(raw: Item): Item {
  return {
    ...raw,
    base_price: num(raw.base_price),
    min_qty: num(raw.min_qty),
    step_qty: num(raw.step_qty),
    item_variants: (raw.item_variants ?? [])
      .map((v) => ({ ...v, price_delta: num(v.price_delta) }))
      .sort(bySort),
    item_extras: (raw.item_extras ?? []).map((e) => ({ ...e, price: num(e.price) })).sort(bySort),
  };
}

export async function getMenu(type: CategoryType): Promise<Category[]> {
  const { data, error } = await db()
    .from("categories")
    .select("id, type, name_ar, sort, items(*, item_variants(*), item_extras(*))")
    .eq("type", type)
    .order("sort");
  if (error) throw new Error(`menu: ${error.message}`);
  return (data as unknown as Category[])
    .map((c) => ({ ...c, items: (c.items ?? []).map(normalizeItem).sort(bySort) }))
    .filter((c) => c.items.length > 0)
    .sort(bySort);
}

export async function getFeatured(type: CategoryType, limit = 4): Promise<Item[]> {
  const menu = await getMenu(type);
  const all = menu.flatMap((c) => c.items);
  const featured = all.filter((i) => i.featured);
  return (featured.length ? featured : all).slice(0, limit);
}

export async function getOffers(): Promise<Offer[]> {
  const { data, error } = await db().from("offers").select("*").order("discount_value", { ascending: false });
  if (error) throw new Error(`offers: ${error.message}`);
  return (data as Offer[]).map((o) => ({ ...o, discount_value: num(o.discount_value) }));
}

export async function getSettings(): Promise<SiteSettings> {
  const { data, error } = await db().from("settings").select("key, value");
  if (error) throw new Error(`settings: ${error.message}`);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return map as unknown as SiteSettings;
}

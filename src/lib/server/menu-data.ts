import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminCategory, AdminItem } from "@/lib/admin-types";

const num = (v: unknown) => Number(v);

/**
 * The whole admin menu in FOUR small parallel queries (categories, items, sizes, extras), merged in memory.
 * This was one deeply nested query that took about a second; the flat ones run side by side.
 */
export async function loadAdminMenu(): Promise<AdminCategory[]> {
  const db = createSupabaseAdmin();
  const [cats, items, variants, extras] = await Promise.all([
    db.from("categories").select("id, type, name_ar, sort, active, is_sample").order("sort"),
    db
      .from("items")
      .select("id, category_id, name_ar, description_ar, unit, base_price, min_qty, step_qty, serving_tag, image_url, active, available, featured, sort, is_sample")
      .order("sort"),
    db.from("item_variants").select("id, item_id, name_ar, price_delta, sort").order("sort"),
    db.from("item_extras").select("id, item_id, name_ar, price, sort").order("sort"),
  ]);
  for (const r of [cats, items, variants, extras]) if (r.error) throw new Error(r.error.message);

  const vByItem = new Map<string, AdminItem["item_variants"]>();
  for (const v of variants.data ?? []) {
    const list = vByItem.get(v.item_id) ?? [];
    list.push({ id: v.id, name_ar: v.name_ar, price_delta: num(v.price_delta), sort: v.sort });
    vByItem.set(v.item_id, list);
  }
  const eByItem = new Map<string, AdminItem["item_extras"]>();
  for (const e of extras.data ?? []) {
    const list = eByItem.get(e.item_id) ?? [];
    list.push({ id: e.id, name_ar: e.name_ar, price: num(e.price), sort: e.sort });
    eByItem.set(e.item_id, list);
  }
  const itemsByCat = new Map<string, AdminItem[]>();
  for (const i of items.data ?? []) {
    const list = itemsByCat.get(i.category_id) ?? [];
    list.push({ ...i, base_price: num(i.base_price), min_qty: num(i.min_qty), step_qty: num(i.step_qty), item_variants: vByItem.get(i.id) ?? [], item_extras: eByItem.get(i.id) ?? [] } as AdminItem);
    itemsByCat.set(i.category_id, list);
  }
  return (cats.data ?? []).map((c) => ({ ...c, items: itemsByCat.get(c.id) ?? [] })) as AdminCategory[];
}

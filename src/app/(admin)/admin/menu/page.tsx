import { MenuManager } from "@/components/admin/MenuManager";
import type { AdminCategory } from "@/lib/admin-types";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminMenuPage() {
  await adminPage(["owner", "manager"]);
  const renderedAt = Date.now(); // before the reads: the data below is at least this fresh
  const { data, error } = await createSupabaseAdmin()
    .from("categories")
    .select("*, items(*, item_variants(*), item_extras(*))")
    .order("sort");
  if (error) throw new Error(error.message);

  const num = (v: unknown) => Number(v);
  const categories = (data as unknown as AdminCategory[]).map((c) => ({
    ...c,
    items: (c.items ?? [])
      .map((i) => ({
        ...i,
        base_price: num(i.base_price),
        min_qty: num(i.min_qty),
        step_qty: num(i.step_qty),
        item_variants: [...(i.item_variants ?? [])].map((v) => ({ ...v, price_delta: num(v.price_delta) })).sort((a, b) => a.sort - b.sort),
        item_extras: [...(i.item_extras ?? [])].map((e) => ({ ...e, price: num(e.price) })).sort((a, b) => a.sort - b.sort),
      }))
      .sort((a, b) => a.sort - b.sort),
  }));
  return <MenuManager categories={categories} renderedAt={renderedAt} />;
}

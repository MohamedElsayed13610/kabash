import { OffersManager } from "@/components/admin/OffersManager";
import type { AdminOffer } from "@/lib/admin-types";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminOffersPage() {
  const renderedAt = Date.now(); // before the reads: the data below is at least this fresh
  const db = createSupabaseAdmin();
  const [, offers, cats, items] = await Promise.all([
    adminPage(["owner", "manager"]),
    db.from("offers").select("id, title_ar, description_ar, image_url, discount_type, discount_value, target_type, target_id, starts_at, ends_at, active, is_sample"),
    db.from("categories").select("id, name_ar, type").order("sort"),
    db.from("items").select("id, name_ar, category_id").order("sort"),
  ]);
  if (offers.error || cats.error || items.error) throw new Error("load failed");

  const catName = new Map((cats.data ?? []).map((c) => [c.id, c.name_ar]));
  const list = (offers.data as unknown as AdminOffer[])
    .map((o) => ({ ...o, discount_value: Number(o.discount_value) }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.title_ar.localeCompare(b.title_ar, "ar"));

  return (
    <OffersManager
      renderedAt={renderedAt}
      offers={list}
      targets={{
        categories: (cats.data ?? []).map((c) => ({ id: c.id, name: c.name_ar, group: c.type === "butcher" ? "جزارة" : "مطعم" })),
        items: (items.data ?? []).map((i) => ({ id: i.id, name: i.name_ar, group: catName.get(i.category_id) ?? "" })),
      }}
    />
  );
}

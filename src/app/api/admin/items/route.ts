import { ApiError } from "@/lib/server/order-service";
import { adminRoute, applyOrder, db, MENU_ROLES, must, mustOne, removeImage, revalidatePublic } from "@/lib/server/admin";
import { itemOp } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export const POST = adminRoute(MENU_ROLES, itemOp, async (input) => {
  let out: unknown = { ok: true };
  switch (input.op) {
    case "save": {
      const cat = must(await db().from("categories").select("id, type").eq("id", input.item.category_id).maybeSingle());
      if (!cat) throw new ApiError(400, "bad_category", "القسم مش موجود.", { category_id: "اختار القسم" });
      if (cat.type === "butcher" && input.item.unit !== "kg") {
        throw new ApiError(400, "unit_mismatch", "أصناف الجزارة بالكيلو.", { unit: "الجزارة بالكيلو" });
      }

      let id = input.id;
      if (id) {
        const old = must(await db().from("items").select("image_url").eq("id", id).maybeSingle());
        if (!old) throw new ApiError(404, "not_found", "الصنف مش موجود.");
        must(await db().from("items").update(input.item).eq("id", id));
        if (old.image_url && old.image_url !== input.item.image_url) await removeImage(old.image_url);
      } else {
        const { data: last } = await db().from("items").select("sort").eq("category_id", input.item.category_id).order("sort", { ascending: false }).limit(1);
        const row = mustOne(await db().from("items").insert({ ...input.item, sort: (last?.[0]?.sort ?? 0) + 1 }).select("id").single());
        id = row.id;
      }

      // variants and extras are replaced as a set; old orders keep their own snapshots
      must(await db().from("item_variants").delete().eq("item_id", id));
      must(await db().from("item_extras").delete().eq("item_id", id));
      if (input.variants.length) {
        must(await db().from("item_variants").insert(input.variants.map((v, i) => ({ item_id: id, name_ar: v.name_ar, price_delta: v.price_delta, sort: i + 1 }))));
      }
      if (input.extras.length) {
        must(await db().from("item_extras").insert(input.extras.map((e, i) => ({ item_id: id, name_ar: e.name_ar, price: e.price, sort: i + 1 }))));
      }
      out = { id };
      break;
    }
    case "patch": {
      const patch: Record<string, boolean> = {};
      for (const k of ["available", "active", "featured"] as const) if (input[k] !== undefined) patch[k] = input[k]!;
      must(await db().from("items").update(patch).eq("id", input.id));
      break;
    }
    case "delete": {
      const old = must(await db().from("items").select("image_url").eq("id", input.id).maybeSingle());
      must(await db().from("items").delete().eq("id", input.id));
      await removeImage(old?.image_url);
      break;
    }
    case "reorder":
      await applyOrder("items", input.ids);
      break;
  }
  revalidatePublic();
  return out;
});

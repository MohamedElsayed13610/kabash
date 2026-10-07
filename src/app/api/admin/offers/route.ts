import { ApiError } from "@/lib/server/order-service";
import { adminRoute, db, MENU_ROLES, must, mustOne, removeImage, revalidatePublic } from "@/lib/server/admin";
import { offerOp } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export const POST = adminRoute(MENU_ROLES, offerOp, async (input) => {
  let out: unknown = { ok: true };
  switch (input.op) {
    case "save": {
      const o = input.offer;
      if (o.target_type !== "cart") {
        const table = o.target_type === "item" ? "items" : "categories";
        const hit = must(await db().from(table).select("id").eq("id", o.target_id!).maybeSingle());
        if (!hit) throw new ApiError(400, "bad_target", "الصنف أو القسم المختار مش موجود.", { target_id: "مش موجود" });
      }
      const row = { ...o, target_id: o.target_type === "cart" ? null : o.target_id };
      if (input.id) {
        const old = must(await db().from("offers").select("image_url").eq("id", input.id).maybeSingle());
        must(await db().from("offers").update(row).eq("id", input.id));
        if (old?.image_url && old.image_url !== row.image_url) await removeImage(old.image_url);
        out = { id: input.id };
      } else {
        out = { id: mustOne(await db().from("offers").insert(row).select("id").single()).id };
      }
      break;
    }
    case "patch":
      must(await db().from("offers").update({ active: input.active }).eq("id", input.id));
      break;
    case "delete": {
      const old = must(await db().from("offers").select("image_url").eq("id", input.id).maybeSingle());
      must(await db().from("offers").delete().eq("id", input.id));
      await removeImage(old?.image_url);
      break;
    }
  }
  revalidatePublic();
  return out;
});

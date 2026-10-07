import { adminRoute, applyOrder, db, MENU_ROLES, must, mustOne, revalidatePublic } from "@/lib/server/admin";
import { zoneOp } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

/** Owner and manager only. Fees apply to NEW orders at once; placed orders keep the fee they were given. */
export const POST = adminRoute(MENU_ROLES, zoneOp, async (input) => {
  let out: unknown = { ok: true };
  switch (input.op) {
    case "save":
      if (input.id) {
        must(await db().from("delivery_zones").update(input.zone).eq("id", input.id));
        out = { id: input.id };
      } else {
        const { data: last } = await db().from("delivery_zones").select("sort").order("sort", { ascending: false }).limit(1);
        out = { id: mustOne(await db().from("delivery_zones").insert({ ...input.zone, sort: (last?.[0]?.sort ?? 0) + 1 }).select("id").single()).id };
      }
      break;
    case "patch":
      must(await db().from("delivery_zones").update({ active: input.active }).eq("id", input.id));
      break;
    case "delete":
      must(await db().from("delivery_zones").delete().eq("id", input.id)); // old orders keep zone_name and fee
      break;
    case "reorder":
      await applyOrder("delivery_zones", input.ids);
      break;
  }
  revalidatePublic();
  return out;
});

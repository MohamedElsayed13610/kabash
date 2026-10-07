import { adminRoute, applyOrder, db, MENU_ROLES, must, mustOne, revalidatePublic } from "@/lib/server/admin";
import { categoryOp } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export const POST = adminRoute(MENU_ROLES, categoryOp, async (input) => {
  let out: unknown = { ok: true };
  switch (input.op) {
    case "create": {
      const { data: last } = await db().from("categories").select("sort").eq("type", input.type).order("sort", { ascending: false }).limit(1);
      const row = mustOne(
        await db().from("categories").insert({ type: input.type, name_ar: input.name_ar, sort: (last?.[0]?.sort ?? 0) + 1, is_sample: false }).select("id").single(),
      );
      out = { id: row.id };
      break;
    }
    case "update": {
      const patch: Record<string, unknown> = {};
      if (input.name_ar !== undefined) patch.name_ar = input.name_ar;
      if (input.active !== undefined) patch.active = input.active;
      must(await db().from("categories").update(patch).eq("id", input.id));
      break;
    }
    case "delete":
      must(await db().from("categories").delete().eq("id", input.id)); // items go with it (FK cascade)
      break;
    case "reorder":
      await applyOrder("categories", input.ids);
      break;
  }
  revalidatePublic();
  return out;
});

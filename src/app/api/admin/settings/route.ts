import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/server/http";
import { ApiError } from "@/lib/server/order-service";
import { db, must, revalidatePublic } from "@/lib/server/admin";
import { requireStaff } from "@/lib/server/staff";
import { settingOp, settingSchemas } from "@/lib/validation/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { key, value } = await readJson(req, settingOp);
    // The free-delivery threshold belongs with delivery zones, so managers may change it. Everything else: owner only.
    const staff = await requireStaff(key === "free_delivery_threshold" ? ["owner", "manager"] : ["owner"]);

    const parsed = settingSchemas[key].safeParse(value);
    if (!parsed.success) {
      throw new ApiError(400, "invalid", parsed.error.issues[0]?.message ?? "القيمة مش صحيحة.", {
        [parsed.error.issues[0]?.path.join(".") || key]: parsed.error.issues[0]?.message ?? "",
      });
    }
    must(await db().from("settings").upsert({ key, value: parsed.data, is_public: true }, { onConflict: "key" }));
    void staff;
    revalidatePublic();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

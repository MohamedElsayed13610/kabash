import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { ApiError } from "@/lib/server/order-service";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const body = z.object({
  subscription: z.object({
    endpoint: z.string().url().max(1000).startsWith("https://"),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  userAgent: z.string().max(300).optional(),
});

/** Registers this device for new-order alerts. One row per device endpoint; re-subscribing just re-links it. */
export async function POST(req: Request) {
  try {
    const staff = await requireStaff();
    const { subscription, userAgent } = await readJson(req, body);
    const { error } = await createSupabaseAdmin()
      .from("push_subscriptions")
      .upsert(
        {
          user_id: staff.userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          user_agent: userAgent ?? null,
          failures: 0,
        },
        { onConflict: "endpoint" },
      );
    if (error) {
      const hint = /push_subscriptions/.test(error.message) ? " (شغّل ملف 0003 في Supabase الأول)" : "";
      throw new ApiError(500, "db_error", `مقدرناش نسجل الجهاز.${hint}`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

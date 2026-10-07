import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { sendPush } from "@/lib/server/push";
import { ApiError, clientIp, hashKey, limit } from "@/lib/server/order-service";

export const dynamic = "force-dynamic";

/** "جرّب الإشعار": sends a test push to the caller's own devices only. */
export async function POST(req: Request) {
  try {
    const staff = await requireStaff();
    await limit(`pushtest:${hashKey(staff.userId + clientIp(req))}`, 5, 60);
    const r = await sendPush(
      { title: "اختبار إشعارات كباش", body: "لو شفت الرسالة دي، الإشعارات شغالة على جهازك.", url: "/staff", tag: "test" },
      { userId: staff.userId },
    );
    if (r.skipped) throw new ApiError(503, "push_unavailable", "الإشعارات مش متظبطة على السيرفر لسه.");
    if (r.sent === 0) throw new ApiError(409, "no_device", "مفيش جهاز مسجل. اضغط تفعيل الإشعارات الأول.");
    return NextResponse.json({ sent: r.sent });
  } catch (e) {
    return fail(e);
  }
}

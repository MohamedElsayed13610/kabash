import { NextResponse } from "next/server";
import { ApiError, clientIp, hashKey, limit } from "@/lib/server/order-service";
import { fail } from "@/lib/server/http";
import { CODE_RE, getTracking } from "@/lib/server/tracking";

export const dynamic = "force-dynamic";

/**
 * Polled by the tracking page every few seconds.
 * Limits: 600 requests/min per IP (a carrier-NAT'd IP may host many open tracking pages),
 * and only 20 WRONG codes per 10 min per IP, which makes guessing codes (32^6 combinations) pointless.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const ip = hashKey(clientIp(req));
    await limit(`track:ip:${ip}`, 600, 60);

    const code = (await params).code.toUpperCase();
    if (!CODE_RE.test(code)) {
      await limit(`track:miss:${ip}`, 20, 600);
      throw new ApiError(404, "not_found", "مفيش طلب بالكود ده. اتأكد من الكود وجرب تاني.");
    }

    const data = await getTracking(code);
    if (!data) {
      await limit(`track:miss:${ip}`, 20, 600);
      throw new ApiError(404, "not_found", "مفيش طلب بالكود ده. اتأكد من الكود وجرب تاني.");
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

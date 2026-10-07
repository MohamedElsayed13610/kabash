import { NextResponse } from "next/server";
import { clientIp, hashKey, limit } from "@/lib/server/order-service";
import { fail } from "@/lib/server/http";
import { CODE_RE, getStatuses } from "@/lib/server/tracking";

export const dynamic = "force-dynamic";

/**
 * GET /api/track-status?codes=ABC234,XYZ789 (max 5).
 * One cheap request for a customer's few recent orders. Returns only code + status + type + time.
 * Same protections as /api/track/[code]: 600 requests/min per IP, and only 20 UNKNOWN codes per 10 min per IP.
 */
export async function GET(req: Request) {
  try {
    const ip = hashKey(clientIp(req));
    await limit(`track:ip:${ip}`, 600, 60);

    const raw = new URL(req.url).searchParams.get("codes") ?? "";
    const codes = [...new Set(raw.toUpperCase().split(",").map((c) => c.trim()).filter(Boolean))].slice(0, 5);
    const valid = codes.filter((c) => CODE_RE.test(c));

    const found = await getStatuses(valid);
    const known = new Set(found.map((f) => f.code));
    const missing = codes.filter((c) => !known.has(c));
    for (let i = 0; i < missing.length; i++) await limit(`track:miss:${ip}`, 20, 600); // each unknown code counts as a wrong guess

    return NextResponse.json({ orders: found, missing }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

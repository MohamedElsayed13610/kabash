import { NextResponse } from "next/server";
import { clientIp, createOrder, hashKey, limit } from "@/lib/server/order-service";
import { fail, readJson } from "@/lib/server/http";
import { orderSchema } from "@/lib/validation/order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const ip = hashKey(clientIp(req));
    await limit(`order:ip:${ip}`, 30, 600); // 30 requests / 10 min per IP (carrier NAT shares IPs, so keep it loose)

    const input = await readJson(req, orderSchema);

    // Honeypot: bots fill the hidden field. Pretend it worked, save nothing.
    if (input.website) return NextResponse.json({ code: "XXXXXX", total: 0 });

    await limit(`order:phone:${hashKey(input.phone)}`, 3, 600); // 3 orders / 10 min per phone
    const { code, total } = await createOrder(input);
    return NextResponse.json({ code, total }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

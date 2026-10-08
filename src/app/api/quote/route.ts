import { NextResponse } from "next/server";
import { normalizeThreshold } from "@/lib/types";
import { buildQuote, clientIp, hashKey, limit } from "@/lib/server/order-service";
import { fail, readJson } from "@/lib/server/http";
import { quoteSchema } from "@/lib/validation/order";

export const dynamic = "force-dynamic";

/** Prices a cart on the server so the checkout screen shows exactly what an order would cost. */
export async function POST(req: Request) {
  try {
    await limit(`quote:ip:${hashKey(clientIp(req))}`, 60, 60);
    const input = await readJson(req, quoteSchema);
    const { totals, canOrder, open, settings } = await buildQuote(input);
    return NextResponse.json({
      totals,
      open,
      canOrder,
      freeDeliveryThreshold: normalizeThreshold(settings.free_delivery_threshold),
    });
  } catch (e) {
    return fail(e);
  }
}

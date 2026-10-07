import { NextResponse } from "next/server";
import { fail } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { getDailySummary } from "@/lib/server/summary";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireStaff();
    return NextResponse.json(await getDailySummary(), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

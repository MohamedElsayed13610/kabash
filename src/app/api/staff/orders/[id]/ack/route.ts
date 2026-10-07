import { NextResponse } from "next/server";
import { z } from "zod";
import { fail } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { acknowledge } from "@/lib/server/staff-orders";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff();
    await acknowledge(staff, z.string().uuid().parse((await params).id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

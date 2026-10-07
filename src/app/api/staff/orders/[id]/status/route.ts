import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { changeStatus } from "@/lib/server/staff-orders";

export const dynamic = "force-dynamic";

const body = z.object({
  status: z.enum(["accepted", "preparing", "out_for_delivery", "delivered", "cancelled"]),
  reason: z.string().trim().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff();
    const { id } = await params;
    const input = await readJson(req, body);
    const out = await changeStatus(staff, z.string().uuid().parse(id), input.status, input.reason);
    return NextResponse.json(out);
  } catch (e) {
    return fail(e);
  }
}

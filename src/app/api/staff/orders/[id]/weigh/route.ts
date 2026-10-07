import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { weigh } from "@/lib/server/staff-orders";

export const dynamic = "force-dynamic";

const body = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().uuid(),
        qtyFinal: z.number().finite().min(0.05).max(50),
        lineFinal: z.number().finite().min(0).max(100000).nullish(),
      }),
    )
    .min(1)
    .max(30),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff();
    const input = await readJson(req, body);
    const out = await weigh(
      staff,
      z.string().uuid().parse((await params).id),
      input.lines.map((l) => ({ id: l.id, qtyFinal: l.qtyFinal, lineFinal: l.lineFinal ?? null })),
    );
    return NextResponse.json(out);
  } catch (e) {
    return fail(e);
  }
}

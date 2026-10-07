import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, readJson } from "@/lib/server/http";
import { requireStaff } from "@/lib/server/staff";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const staff = await requireStaff();
    const { endpoint } = await readJson(req, z.object({ endpoint: z.string().url().max(1000) }));
    // scoped to the caller's own rows
    await createSupabaseAdmin().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", staff.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

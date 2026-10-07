import { redirect } from "next/navigation";
import { Board } from "@/components/staff/Board";
import { boardFilter, ORDER_SELECT, type BoardOrder } from "@/lib/staff-types";
import { getStaff } from "@/lib/server/staff";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StaffHome() {
  const staff = await getStaff();
  if (!staff) redirect("/staff/login");

  // Read with the staff member's own session, so Row Level Security decides what they can see.
  const supa = await createSupabaseServer();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data } = await supa.from("orders").select(ORDER_SELECT).or(boardFilter(since));

  return <Board initial={(data ?? []) as unknown as BoardOrder[]} staff={{ name: staff.name, role: staff.role }} />;
}

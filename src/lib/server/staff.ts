import "server-only";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { ApiError } from "./order-service";

export type StaffRole = "owner" | "manager" | "cashier";

export interface Staff {
  userId: string;
  name: string;
  role: StaffRole;
}

/**
 * The signed-in, ACTIVE staff member, or null. getUser() re-validates the session token with
 * Supabase (unlike getSession), and the role comes from the profiles table, never from the browser.
 */
export async function getStaff(): Promise<Staff | null> {
  const supa = await createSupabaseServer();
  const { data } = await supa.auth.getUser();
  if (!data.user) return null;
  const { data: p } = await createSupabaseAdmin()
    .from("profiles")
    .select("name, role, active")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!p || !p.active) return null;
  return { userId: data.user.id, name: p.name, role: p.role };
}

/** For API routes: 401 if not staff, 403 if the role is not allowed. */
export async function requireStaff(allowed: StaffRole[] = ["owner", "manager", "cashier"]): Promise<Staff> {
  const s = await getStaff();
  if (!s) throw new ApiError(401, "unauthorized", "سجّل دخولك الأول.");
  if (!allowed.includes(s.role)) throw new ApiError(403, "forbidden", "مفيش عندك صلاحية للحاجة دي.");
  return s;
}

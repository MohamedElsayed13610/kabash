import "server-only";
import { cache } from "react";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { ApiError } from "./order-service";

export type StaffRole = "owner" | "manager" | "cashier";

export interface Staff {
  userId: string;
  name: string;
  role: StaffRole;
}

/**
 * The signed-in, ACTIVE staff member, or null.
 *
 * Identity: getClaims() verifies the session token's signature and expiry LOCALLY (ES256 keys, no network call).
 * Authorization: the role and the `active` flag are read from the profiles table on EVERY request, so stopping an
 * account or changing a role takes effect immediately. The browser is never trusted for either.
 *
 * Wrapped in React cache(): the admin layout and the page share one lookup per request instead of repeating it.
 */
export const getStaff = cache(async (): Promise<Staff | null> => {
  const supa = await createSupabaseServer();
  const { data } = await supa.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: p } = await createSupabaseAdmin()
    .from("profiles")
    .select("name, role, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (!p || !p.active) return null;
  return { userId, name: p.name, role: p.role };
});

/** For API routes: 401 if not staff, 403 if the role is not allowed. */
export async function requireStaff(allowed: StaffRole[] = ["owner", "manager", "cashier"]): Promise<Staff> {
  const s = await getStaff();
  if (!s) throw new ApiError(401, "unauthorized", "سجّل دخولك الأول.");
  if (!allowed.includes(s.role)) throw new ApiError(403, "forbidden", "مفيش عندك صلاحية للحاجة دي.");
  return s;
}

import { redirect } from "next/navigation";
import { LoginForm } from "@/components/staff/LoginForm";
import { landingFor, safeNext } from "@/lib/safe-redirect";
import { getStaff } from "@/lib/server/staff";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StaffLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const staff = await getStaff();
  if (staff) redirect(landingFor(staff.role, next));
  // signed in with an account that has no active staff profile
  const { data } = await (await createSupabaseServer()).auth.getClaims();
  return <LoginForm signedInButNotStaff={!!data?.claims?.sub} next={next} />;
}

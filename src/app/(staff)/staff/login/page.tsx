import { redirect } from "next/navigation";
import { LoginForm } from "@/components/staff/LoginForm";
import { getStaff } from "@/lib/server/staff";
import { createSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StaffLogin() {
  if (await getStaff()) redirect("/staff");
  // signed in with an account that has no active staff profile
  const { data } = await (await createSupabaseServer()).auth.getClaims();
  return <LoginForm signedInButNotStaff={!!data?.claims?.sub} />;
}

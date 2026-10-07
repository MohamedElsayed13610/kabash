import { StaffManager, type StaffRow } from "@/components/admin/StaffManager";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminStaffPage() {
  const me = await adminPage(["owner"]);
  const db = createSupabaseAdmin();
  const [{ data: profiles, error }, users] = await Promise.all([
    db.from("profiles").select("user_id, name, role, active, created_at").order("created_at"),
    db.auth.admin.listUsers({ perPage: 200 }),
  ]);
  if (error) throw new Error(error.message);
  const byId = new Map(users.data.users.map((u) => [u.id, u]));
  const rows: StaffRow[] = (profiles ?? []).map((p) => ({
    user_id: p.user_id,
    name: p.name,
    role: p.role,
    active: p.active,
    email: byId.get(p.user_id)?.email ?? "—",
    last_sign_in: byId.get(p.user_id)?.last_sign_in_at ?? null,
  }));
  return <StaffManager staff={rows} meId={me.userId} />;
}

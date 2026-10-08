import { SettingsForm } from "@/components/admin/SettingsForm";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { SiteSettings } from "@/lib/types";

export default async function AdminSettingsPage() {
  const [, { data, error }] = await Promise.all([adminPage(["owner"]), createSupabaseAdmin().from("settings").select("key, value")]);
  if (error) throw new Error(error.message);
  const settings = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as unknown as SiteSettings;
  return <SettingsForm settings={settings} />;
}

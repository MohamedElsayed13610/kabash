import { ZonesManager } from "@/components/admin/ZonesManager";
import type { AdminZone } from "@/lib/admin-types";
import { normalizeThreshold } from "@/lib/types";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminZonesPage() {
  const renderedAt = Date.now(); // before the reads: the data below is at least this fresh
  const db = createSupabaseAdmin();
  const [, zones, setting] = await Promise.all([
    adminPage(["owner", "manager"]),
    db.from("delivery_zones").select("id, name_ar, fee, min_order, eta_minutes, sort, active, is_sample").order("sort"),
    db.from("settings").select("value").eq("key", "free_delivery_threshold").maybeSingle(),
  ]);
  if (zones.error) throw new Error(zones.error.message);
  return (
    <ZonesManager
      zones={(zones.data as unknown as AdminZone[]).map((z) => ({ ...z, fee: Number(z.fee), min_order: Number(z.min_order) }))}
      threshold={normalizeThreshold(setting.data?.value)}
      renderedAt={renderedAt}
    />
  );
}

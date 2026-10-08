import { ZonesManager } from "@/components/admin/ZonesManager";
import type { AdminZone } from "@/lib/admin-types";
import { normalizeThreshold } from "@/lib/types";
import { adminPage } from "@/lib/server/admin-page";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export default async function AdminZonesPage() {
  await adminPage(["owner", "manager"]);
  const renderedAt = Date.now(); // before the reads: the data below is at least this fresh
  const db = createSupabaseAdmin();
  const [zones, setting] = await Promise.all([
    db.from("delivery_zones").select("*").order("sort"),
    db.from("settings").select("value").eq("key", "free_delivery_threshold").maybeSingle(),
  ]);
  if (zones.error) throw new Error(zones.error.message);
  const threshold = normalizeThreshold(setting.data?.value);
  return (
    <ZonesManager
      zones={(zones.data as unknown as AdminZone[]).map((z) => ({ ...z, fee: Number(z.fee), min_order: Number(z.min_order) }))}
      threshold={threshold}
      renderedAt={renderedAt}
    />
  );
}

import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { CheckoutForm, type ZoneOption } from "@/components/cart/CheckoutForm";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSettings } from "@/lib/data";

export const revalidate = 0; // zones and fees must always be live
export const metadata: Metadata = { title: "إتمام الطلب | كباش", robots: { index: false } };

async function getZones(): Promise<ZoneOption[]> {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await db
    .from("delivery_zones")
    .select("id, name_ar, fee, min_order, eta_minutes")
    .eq("active", true)
    .order("sort");
  if (error) throw new Error(`zones: ${error.message}`);
  return data.map((z) => ({ ...z, fee: Number(z.fee), min_order: Number(z.min_order) }));
}

export default async function CheckoutPage() {
  const [zones, settings] = await Promise.all([getZones(), getSettings()]);
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <CheckoutForm zones={zones} />
    </main>
  );
}

import type { Metadata } from "next";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import { SiteHeader } from "@/components/site/SiteHeader";
import { getSettings, getZones } from "@/lib/data";

// Zones are public data cached under the "zones" tag; saving a zone in the admin refreshes this page at once.
// Totals are NOT computed here: /api/quote and /api/orders always re-read prices, fees and offers from the database.
export const revalidate = 300;
export const metadata: Metadata = { title: "إتمام الطلب | كباش", robots: { index: false } };

export default async function CheckoutPage() {
  const [zones, settings] = await Promise.all([getZones(), getSettings()]);
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <CheckoutForm zones={zones} />
    </main>
  );
}

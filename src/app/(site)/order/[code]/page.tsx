import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/SiteHeader";
import { TrackingView } from "@/components/track/TrackingView";
import { getSettings } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تابع طلبك | كباش", robots: { index: false, follow: false } };

/**
 * Deliberately does NOT read the order on the server: every lookup by code must go through
 * /api/track/[code], the one place that rate-limits guesses and whitelists the fields.
 */
export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) notFound();
  const settings = await getSettings();
  const info = settings.restaurant_info;
  return (
    <main>
      <SiteHeader phone={info.phone} />
      <TrackingView code={code} whatsapp={info.whatsapp} phone={info.phone} />
    </main>
  );
}

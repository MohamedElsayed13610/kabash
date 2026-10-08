import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { TrackSection } from "@/components/site/TrackSection";
import { getSettings } from "@/lib/data";

export const revalidate = 300; // safety net only: admin changes expire the cache tags at once
export const metadata: Metadata = {
  title: "تتبع طلبك | كباش",
  description: "تابع طلبك من كباش لحظة بلحظة، من التحضير لحد ما يوصلك.",
  robots: { index: false },
};

export default async function TrackPage() {
  const settings = await getSettings();
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <div className="pt-10 pb-10">
        <TrackSection limit={8} as="page" />
      </div>
    </main>
  );
}

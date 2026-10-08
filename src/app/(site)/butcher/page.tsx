import type { Metadata } from "next";
import { ClosedNotice } from "@/components/site/OpenStatus";
import { SiteHeader } from "@/components/site/SiteHeader";
import { MenuView } from "@/components/menu/MenuView";
import { PageIntro } from "@/components/menu/PageIntro";
import { getMenu, getOffers, getSettings } from "@/lib/data";

export const revalidate = 300; // safety net only: admin changes expire the cache tags at once
export const metadata: Metadata = {
  title: "الجزارة | كباش",
  description: "لحوم ومصنعات فريش كل يوم. اطلب بالكيلو واحنا نقطع ونوزن على طلبك.",
};

export default async function ButcherPage() {
  const [categories, offers, settings] = await Promise.all([getMenu("butcher"), getOffers(), getSettings()]);
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <PageIntro
        title="جزارة كباش"
        blurb="لحوم ومصنعات فريش كل يوم. السعر تقديري والسعر النهائي بعد الوزن."
        settings={settings}
      />
      <ClosedNotice settings={settings} />
      {categories.length === 0 ? (
        <p className="px-5 py-16 text-center text-lg">الجزارة لسه بتجهز الطلبات. ارجع لنا بعد شوية.</p>
      ) : (
        <MenuView categories={categories} kind="butcher" offers={offers} />
      )}
    </main>
  );
}

import type { Metadata } from "next";
import { ClosedNotice } from "@/components/site/OpenStatus";
import { SiteHeader } from "@/components/site/SiteHeader";
import { MenuView } from "@/components/menu/MenuView";
import { PageIntro } from "@/components/menu/PageIntro";
import { pageMeta } from "@/lib/site";
import { getMenu, getOffers, getSettings } from "@/lib/data";

export const revalidate = 300; // safety net only: admin changes expire the cache tags at once
export const metadata: Metadata = pageMeta("/menu", "المنيو | كباش", "مندي، مدفون، برياني، مضغوط، وصواني ومشاوي. اطلب من كباش لحد باب بيتك.");

export default async function MenuPage() {
  const [categories, offers, settings] = await Promise.all([getMenu("restaurant"), getOffers(), getSettings()]);
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <PageIntro
        title="صواني الكباش"
        blurb="أكل خليجي بروح مصرية. الصينية الكبيرة تتشارك، والصغيرة تكفيك."
        settings={settings}
      />
      <ClosedNotice settings={settings} />
      {categories.length === 0 ? (
        <p className="px-5 py-16 text-center text-lg">المنيو لسه بيتجهز. ارجع لنا بعد شوية.</p>
      ) : (
        <MenuView categories={categories} kind="restaurant" offers={offers} />
      )}
    </main>
  );
}

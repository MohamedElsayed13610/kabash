import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { PageIntro } from "@/components/menu/PageIntro";
import { Reveal } from "@/components/ui/Reveal";
import { pageMeta } from "@/lib/site";
import { getOffers, getSettings } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

export const revalidate = 300; // safety net only: admin changes expire the cache tags at once
export const metadata: Metadata = pageMeta("/offers", "العروض | كباش", "عروض كباش الحالية على المندي والجزارة وطلبات التوصيل.");

const BLOCKS = ["bg-saffron text-charcoal", "bg-ember text-ivory", "bg-forest text-ivory"];

export default async function OffersPage() {
  const [offers, settings] = await Promise.all([getOffers(), getSettings()]);
  return (
    <main>
      <SiteHeader phone={settings.restaurant_info.phone} />
      <PageIntro title="العروض" blurb="الخصم بيتحسب لوحده في الصينية، مفيش كود تكتبه." settings={settings} />
      <div className="mx-auto max-w-xl space-y-5 px-5 py-10">
        {offers.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display text-3xl text-forest">مفيش عروض دلوقتي</p>
            <p className="mt-2 text-charcoal/75">بنجهز عروض جديدة. بص على المنيو لحد ما ننزلها.</p>
            <Link href="/menu" className="mt-6 inline-grid h-12 place-items-center rounded-full bg-ember px-7 font-display text-xl text-ivory">
              شوف المنيو
            </Link>
          </div>
        ) : (
          offers.map((o, i) => (
            <Reveal key={o.id} delay={i * 80}>
              <article className={`overflow-hidden rounded-3xl ${BLOCKS[i % BLOCKS.length]}`}>
                {o.image_url && <Image src={o.image_url} alt={o.title_ar} width={800} height={400} className="h-40 w-full object-cover" />}
                <div className="p-6">
                  <p className="font-display text-7xl leading-none">
                    {o.discount_type === "percent" ? `${o.discount_value}%` : formatMoney(o.discount_value)}
                    {o.discount_type === "fixed" && <span className="ms-2 text-3xl">{ar.currency}</span>}
                  </p>
                  <h2 className="mt-3 font-display text-3xl leading-tight">{o.title_ar}</h2>
                  {o.description_ar && <p className="mt-1 opacity-90">{o.description_ar}</p>}
                  {o.ends_at && (
                    <p className="mt-3 text-sm opacity-80">
                      لحد {new Date(o.ends_at).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long" })}
                    </p>
                  )}
                </div>
              </article>
            </Reveal>
          ))
        )}
      </div>
    </main>
  );
}

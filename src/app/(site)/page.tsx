import Link from "next/link";
import { Hero } from "@/components/site/Hero";
import { OpenBadge } from "@/components/site/OpenStatus";
import { ItemArt } from "@/components/ui/ItemArt";
import { Reveal } from "@/components/ui/Reveal";
import { Stamp } from "@/components/ui/Stamp";
import { getFeatured, getOffers, getSettings } from "@/lib/data";
import { formatClock, formatMoney, price } from "@/lib/format";
import { startingPrice } from "@/lib/pricing/unit";
import { ar } from "@/messages/ar";

export const revalidate = 60;

const DAYS = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
const OFFER_BLOCKS = ["bg-saffron text-charcoal", "bg-ember text-ivory", "bg-forest text-ivory"];

const STEPS = [
  { n: "1", title: "اختار", body: "من صواني المطعم أو من الجزارة، وحدد الحجم أو الوزن اللي يناسبك." },
  { n: "2", title: "ابعت الطلب", body: "اكتب اسمك وعنوانك، والدفع كاش عند الاستلام." },
  { n: "3", title: "استنى الصينية", body: "بنوصلك لحد الباب، وتتابع طلبك خطوة بخطوة." },
];

export default async function Home() {
  const [settings, offers, dishes, cuts] = await Promise.all([
    getSettings(),
    getOffers(),
    getFeatured("restaurant", 3),
    getFeatured("butcher", 4),
  ]);
  const info = settings.restaurant_info;
  const hasPhone = /^\d+$/.test(info.phone);
  const hasWhatsapp = /^\d+$/.test(info.whatsapp);

  return (
    <main>
      <Hero settings={settings} />

      {/* offers */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-xl pt-20" aria-labelledby="offers-h">
          <Reveal className="flex items-baseline justify-between px-5">
            <h2 id="offers-h" className="font-display text-4xl text-forest">
              عروض النهارده
            </h2>
            <Link href="/offers" className="text-forest underline underline-offset-4">
              كل العروض
            </Link>
          </Reveal>
          <ul className="no-scrollbar mt-4 flex snap-x gap-3 overflow-x-auto px-5 pb-2">
            {offers.map((o, i) => (
              <li
                key={o.id}
                className={`w-64 shrink-0 snap-start rounded-3xl p-5 ${OFFER_BLOCKS[i % OFFER_BLOCKS.length]} ${i % 2 ? "mt-4" : ""}`}
              >
                <p className="font-display text-6xl leading-none">
                  {o.discount_type === "percent" ? `${o.discount_value}%` : formatMoney(o.discount_value)}
                  {o.discount_type === "fixed" && <span className="ms-1 text-2xl">{ar.currency}</span>}
                </p>
                <p className="mt-3 font-display text-2xl leading-tight">{o.title_ar}</p>
                {o.description_ar && <p className="mt-1 text-sm opacity-85">{o.description_ar}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* restaurant highlights */}
      <section className="mx-auto max-w-xl px-5 pt-16" aria-labelledby="dishes-h">
        <Reveal>
          <h2 id="dishes-h" className="font-display text-4xl text-forest">
            صواني الكباش
          </h2>
          <div className="sadu mt-1 h-2 w-40 text-leaf" aria-hidden />
        </Reveal>
        <div className="mt-6 space-y-6">
          {dishes.map((d, i) => (
            <Reveal key={d.id} delay={i * 80}>
              <Link href="/menu" className={`flex items-center gap-4 ${i % 2 ? "flex-row-reverse" : ""}`}>
                <ItemArt
                  name={d.name_ar}
                  src={d.image_url}
                  index={i}
                  sizes="176px"
                  className={`shrink-0 rounded-full ${i === 0 ? "size-44" : "size-32"}`}
                />
                <div className={i % 2 ? "text-end" : ""}>
                  <h3 className="font-display text-3xl leading-tight">{d.name_ar}</h3>
                  {d.serving_tag && <p className="text-sm text-forest">{d.serving_tag}</p>}
                  <p className="mt-1 font-display text-2xl text-ember">من {price(startingPrice(d))}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
        <Link
          href="/menu"
          className="mt-8 inline-grid h-12 place-items-center rounded-full border-2 border-forest px-7 font-display text-xl text-forest"
        >
          شوف المنيو كله
        </Link>
      </section>

      {/* butcher */}
      <section className="mt-20 bg-forest-deep py-14 text-ivory" aria-labelledby="butcher-h">
        <div className="mx-auto max-w-xl px-5">
          <Reveal>
            <Stamp label={ar.butcher.fresh} className="!border-saffron !text-saffron" />
            <h2 id="butcher-h" className="mt-3 font-display text-5xl leading-tight">
              جزارة كباش
            </h2>
            <p className="mt-2 max-w-[19rem] text-ivory/85">
              لحوم ومصنعات فريش كل يوم. اطلب بالكيلو واحنا بنقطع ونوزن على طلبك.
            </p>
          </Reveal>
          <ul className="mt-8">
            {cuts.map((c, i) => (
              <Reveal key={c.id} delay={i * 70}>
                <li className="flex items-baseline justify-between border-b border-leaf/25 py-3">
                  <span className="font-display text-3xl">{c.name_ar}</span>
                  <span className="font-display text-2xl text-saffron">
                    {formatMoney(c.base_price)} <span className="font-body text-sm text-ivory/70">{ar.currency} / كجم</span>
                  </span>
                </li>
              </Reveal>
            ))}
          </ul>
          <Link
            href="/butcher"
            className="mt-8 inline-grid h-12 place-items-center rounded-full bg-saffron px-7 font-display text-xl text-charcoal"
          >
            اطلب بالوزن
          </Link>
        </div>
      </section>

      {/* how to order */}
      <section className="mx-auto max-w-xl px-5 pt-16" aria-labelledby="how-h">
        <Reveal>
          <h2 id="how-h" className="font-display text-4xl text-forest">
            إزاي تطلب
          </h2>
        </Reveal>
        <ol className="mt-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <li className={`flex items-start gap-4 py-3 ${i === 1 ? "ps-10" : i === 2 ? "ps-20" : ""}`}>
                <span className="font-display text-7xl leading-[0.8] text-ember">{s.n}</span>
                <span>
                  <span className="block font-display text-2xl">{s.title}</span>
                  <span className="text-charcoal/80">{s.body}</span>
                </span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* find us */}
      <section className="mx-auto max-w-xl px-5 pt-16 pb-10" aria-labelledby="find-h">
        <Reveal>
          <h2 id="find-h" className="font-display text-4xl text-forest">
            تلاقينا فين
          </h2>
          <p className="mt-2 text-lg">{info.address_ar}</p>
          <div className="mt-3">
            <OpenBadge settings={settings} tone="light" />
          </div>
        </Reveal>
        <Reveal delay={80}>
          <table className="mt-6 w-full text-start">
            <caption className="sr-only">مواعيد العمل</caption>
            <tbody>
              {settings.opening_hours.days.map((d) => (
                <tr key={d.day} className="border-b border-charcoal/10">
                  <th scope="row" className="py-2 text-start font-medium">
                    {DAYS[d.day]}
                  </th>
                  <td className="py-2 text-end tabular-nums text-charcoal/80">
                    {d.closed ? "أجازة" : `${formatClock(d.open)} – ${formatClock(d.close)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-xs text-charcoal/50">المواعيد دي مؤقتة لحد ما المطعم يضبطها.</p>
        </Reveal>
        <Reveal delay={120} className="mt-6 flex flex-wrap gap-3">
          {hasPhone && (
            <a href={`tel:${info.phone}`} className="grid h-12 place-items-center rounded-full bg-forest px-6 text-ivory">
              اتصل بينا
            </a>
          )}
          {hasWhatsapp && (
            <a
              href={`https://wa.me/${info.whatsapp}`}
              className="grid h-12 place-items-center rounded-full border-2 border-forest px-6 text-forest"
            >
              واتساب
            </a>
          )}
        </Reveal>
      </section>
    </main>
  );
}

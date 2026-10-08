import Image from "next/image";
import Link from "next/link";
import { ar } from "@/messages/ar";
import type { SiteSettings } from "@/lib/types";
import { OpenBadge } from "./OpenStatus";

const SPARKS = [
  { left: "18%", delay: "0s", drift: "-14px" },
  { left: "34%", delay: "0.9s", drift: "10px" },
  { left: "52%", delay: "1.7s", drift: "-8px" },
  { left: "68%", delay: "0.4s", drift: "16px" },
  { left: "82%", delay: "2.3s", drift: "-12px" },
];

const WISPS = [
  { left: "30%", delay: "0s" },
  { left: "50%", delay: "1.5s" },
  { left: "68%", delay: "3s" },
];

export function Hero({ settings }: { settings: SiteSettings }) {
  return (
    <section className="relative overflow-hidden bg-forest text-ivory">
      {/* soft flame glow behind the tray */}
      {/* flame glow: a gradient, not a blur filter (filters are expensive on cheap phones) */}
      <div
        aria-hidden
        className="absolute -bottom-32 start-1/2 size-[34rem] -translate-x-1/2 rounded-full rtl:translate-x-1/2"
        style={{ background: "radial-gradient(closest-side, rgba(232,89,26,0.28), rgba(232,89,26,0) 100%)" }}
      />
      <div className="relative mx-auto max-w-xl px-5 pt-5">
        <div className="flex items-center justify-between">
          <div className="stamp-in flex items-center gap-3">
            <Image src="/brand/logo.png" alt={ar.brand.name} width={64} height={64} priority className="size-16" />
            <span className="leading-none">
              <span className="block font-display text-4xl">{ar.brand.name}</span>
              <span className="block text-xs tracking-[0.35em] text-leaf">{ar.brand.latin}</span>
            </span>
          </div>
          <OpenBadge settings={settings} />
        </div>

        <h1 className="rise-in mt-10 font-display text-[3.4rem] leading-[1.05]" style={{ animationDelay: "0.25s" }}>
          نكهة خليجية
          <span className="block text-saffron">بروح مصرية</span>
        </h1>
        <p className="rise-in mt-4 max-w-[17rem] text-lg text-ivory/90" style={{ animationDelay: "0.4s" }}>
          مندي ومدفون وبرياني على أصوله، وجزارة لحوم فريش كل يوم. من بني مزار لحد باب بيتك.
        </p>

        <div className="rise-in mt-6 flex items-center gap-4" style={{ animationDelay: "0.55s" }}>
          <Link
            href="/menu"
            className="grid h-14 place-items-center rounded-full bg-ember px-8 font-display text-2xl text-ivory transition active:scale-95"
          >
            اطلب دلوقتي
          </Link>
          <Link href="/butcher" className="inline-flex min-h-11 items-center px-2 text-lg underline decoration-leaf decoration-2 underline-offset-8">
            الجزارة
          </Link>
        </div>

        {/* the tray, with steam and embers rising behind the lettering */}
        <div className="relative mt-4 h-72">
          <div aria-hidden className="absolute inset-x-0 bottom-0 top-0">
            {WISPS.map((w) => (
              <span
                key={w.left}
                className="steam absolute bottom-24 h-24 w-12 rounded-full"
                style={{ left: w.left, animationDelay: w.delay, background: "radial-gradient(closest-side, rgba(245,242,228,0.38), rgba(245,242,228,0) 100%)" }}
              />
            ))}
            {SPARKS.map((s) => (
              <span
                key={s.left}
                className="ember absolute bottom-24 size-1.5 rounded-full bg-saffron"
                style={{ left: s.left, animationDelay: s.delay, ["--drift" as string]: s.drift }}
              />
            ))}
          </div>
          <div className="stamp-in absolute -bottom-12 -start-10 size-72 rounded-full ring-4 ring-leaf/40 ring-offset-4 ring-offset-forest" style={{ animationDelay: "0.2s" }}>
            <Image
              src="/brand/tray.jpg"
              alt="صينية مشاوي كباش بالخضار، بتتقدم بإيدين"
              width={470}
              height={450}
              priority
              sizes="288px"
              className="size-full rounded-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

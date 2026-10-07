import { OpenBadge } from "../site/OpenStatus";
import type { SiteSettings } from "@/lib/types";

/** Page heading block for /menu and /butcher: big display type on forest, ring motif cropped at the edge. */
export function PageIntro({ title, blurb, settings }: { title: string; blurb: string; settings: SiteSettings }) {
  return (
    <div className="relative overflow-hidden bg-forest pb-8 text-ivory">
      <svg aria-hidden viewBox="0 0 200 200" className="absolute -bottom-16 -end-16 size-56 text-leaf/25">
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="100" cy="100" r="78" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 6" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="relative mx-auto max-w-xl px-5 pt-4">
        <h1 className="rise-in font-display text-6xl leading-none">{title}</h1>
        <p className="rise-in mt-3 max-w-[18rem] text-ivory/90" style={{ animationDelay: "0.15s" }}>
          {blurb}
        </p>
        <div className="mt-4">
          <OpenBadge settings={settings} />
        </div>
      </div>
    </div>
  );
}

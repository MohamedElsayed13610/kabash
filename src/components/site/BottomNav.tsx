"use client";

import Link, { useLinkStatus } from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ar } from "@/messages/ar";
import { useOrderStatus } from "./OrderStatusProvider";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const TABS = [
  {
    href: "/",
    label: ar.nav.home,
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
        <path d="M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    href: "/menu",
    label: ar.nav.menu,
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
      </svg>
    ),
  },
  {
    href: "/butcher",
    label: ar.nav.butcher,
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
        <path d="M4 8h11a5 5 0 0 1 5 5v1H4V8zM4 8V5M9 14v4M15 14v4" />
      </svg>
    ),
  },
  {
    href: "/track",
    label: "تتبع طلبك",
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
        <path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    href: "/offers",
    label: ar.nav.offers,
    icon: (
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden {...stroke}>
        <path d="M3 12V4h8l10 10-8 8L3 12z" />
        <circle cx="7.5" cy="8.5" r="1.2" />
      </svg>
    ),
  },
];

/** Lights up the moment a tab is tapped, until the page arrives (instant feedback without a loading skeleton). */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="absolute inset-x-4 top-0 h-1 animate-pulse rounded-b-full bg-saffron" /> : null;
}

export function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { active } = useOrderStatus();

  // Warm up every page the bar leads to as soon as the browser is idle, so a tap is instant even on a slow connection.
  useEffect(() => {
    const warm = () => TABS.forEach((t) => router.prefetch(t.href));
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(warm);
    else setTimeout(warm, 800);
  }, [router]);
  if (path === "/checkout") return null; // the order button owns the bottom edge here
  return (
    <nav
      aria-label="التنقل"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-leaf/20 bg-forest-deep pb-[env(safe-area-inset-bottom)] text-ivory"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const on = t.href === "/" ? path === "/" : path.startsWith(t.href) || (t.href === "/track" && path.startsWith("/order/"));
          const live = active.length;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex h-[4.25rem] flex-col items-center justify-center gap-0.5 text-xs ${
                  on ? "text-saffron" : "text-ivory/75"
                }`}
              >
                <Pending />
                <span className="relative">
                  {t.icon}
                  {t.href === "/track" && live > 0 && (
                    <span data-testid="track-badge" className="absolute -end-1 -top-0.5 size-3 rounded-full bg-ember ring-2 ring-forest-deep" aria-label={`${live} طلب شغال`} />
                  )}
                </span>
                <span className={on ? "font-bold" : ""}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

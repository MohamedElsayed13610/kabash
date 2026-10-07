"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ar } from "@/messages/ar";

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

export function BottomNav() {
  const path = usePathname();
  if (path === "/checkout") return null; // the order button owns the bottom edge here
  return (
    <nav
      aria-label="التنقل"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-leaf/20 bg-forest-deep pb-[env(safe-area-inset-bottom)] text-ivory"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[4.25rem] flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "text-saffron" : "text-ivory/75"
                }`}
              >
                {t.icon}
                <span className={active ? "font-bold" : ""}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";
import { getOpenState, type OpenState } from "@/lib/hours";
import { formatClock } from "@/lib/format";

type Hours = Pick<SiteSettings, "opening_hours" | "open_override">;

/**
 * Open or closed, worked out in the browser from the (cached) hours.
 * Returns null on the server and on the first client render, so the cached HTML never claims a state that the
 * browser would disagree with; the real state appears right after hydration and then refreshes every minute.
 */
export function useOpenState(settings: Hours): OpenState | null {
  const [state, setState] = useState<OpenState | null>(null);
  useEffect(() => {
    const tick = () => setState(getOpenState(settings));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [settings]);
  return state;
}

export function OpenBadge({ settings, tone = "dark" }: { settings: Hours; tone?: "dark" | "light" }) {
  const s = useOpenState(settings);
  const base = "inline-flex min-h-8 items-center gap-2 rounded-full px-3 py-1 text-sm font-medium";
  if (!s) {
    // same size as the real badge, so nothing jumps when it fills in
    return <span className={`${base} ${tone === "dark" ? "bg-ivory/15 text-ivory" : "bg-charcoal/10 text-charcoal"}`}>مواعيد الشغل</span>;
  }
  const text = s.open
    ? s.closesAt
      ? `مفتوح لحد ${formatClock(s.closesAt)}`
      : "مفتوح دلوقتي"
    : s.opensAt
      ? `مقفول، بنفتح ${formatClock(s.opensAt)}`
      : "مقفول دلوقتي";
  const palette =
    tone === "dark"
      ? s.open
        ? "bg-leaf text-forest-deep"
        : "bg-ivory/15 text-ivory"
      : s.open
        ? "bg-forest text-ivory"
        : "bg-charcoal/10 text-charcoal";
  return (
    <span className={`${base} ${palette}`}>
      <span className={`size-2 rounded-full ${s.open ? "bg-ember-bright" : "bg-current opacity-50"}`} aria-hidden />
      {text}
    </span>
  );
}

export function ClosedNotice({ settings }: { settings: Hours & Pick<SiteSettings, "accept_orders_when_closed"> }) {
  const s = useOpenState(settings);
  if (!s || s.open) return null;
  return (
    <div role="status" className="bg-saffron px-4 py-3 text-center text-charcoal">
      <p className="font-display text-xl">المطعم مقفول دلوقتي، والنار مطفية</p>
      <p className="text-sm">
        {s.opensAt ? `بنولّع تاني الساعة ${formatClock(s.opensAt)}. ` : ""}
        {settings.accept_orders_when_closed
          ? "اطلب دلوقتي وهنجهزه أول ما نفتح."
          : "اتفرج على المنيو براحتك، وابعت طلبك أول ما نفتح."}
      </p>
    </div>
  );
}

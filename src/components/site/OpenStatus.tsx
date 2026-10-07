"use client";

import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/types";
import { getOpenState, type OpenState } from "@/lib/hours";
import { formatClock } from "@/lib/format";

type Hours = Pick<SiteSettings, "opening_hours" | "open_override">;

/** Recomputed on the client so a cached page never shows a stale open/closed state. */
export function useOpenState(settings: Hours): OpenState {
  const [state, setState] = useState(() => getOpenState(settings));
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
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${palette}`}>
      <span className={`size-2 rounded-full ${s.open ? "bg-ember-bright" : "bg-current opacity-50"}`} aria-hidden />
      {text}
    </span>
  );
}

export function ClosedNotice({ settings }: { settings: Hours & Pick<SiteSettings, "accept_orders_when_closed"> }) {
  const s = useOpenState(settings);
  if (s.open) return null;
  return (
    <div role="status" className="bg-saffron px-4 py-3 text-center text-charcoal">
      <p className="font-display text-xl">المطعم مقفول دلوقتي</p>
      <p className="text-sm">
        {settings.accept_orders_when_closed
          ? "تقدر تطلب وهنجهزه أول ما نفتح."
          : "تقدر تتصفح المنيو، وتبعت طلبك أول ما نفتح."}
      </p>
    </div>
  );
}

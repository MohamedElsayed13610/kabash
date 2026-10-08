"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrderStatus } from "./OrderStatusProvider";
import { Reveal } from "../ui/Reveal";
import { removeRecentOrder, type RecentOrder } from "@/lib/recent-orders";
import { statusLabel } from "@/lib/tracking-labels";
import { isTerminal, stageOf } from "@/lib/tracking-types";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

const ago = (at: number) => {
  const min = Math.floor((Date.now() - at) / 60000);
  if (min < 1) return "دلوقتي";
  if (min < 60) return `من ${min} دقيقة`;
  const h = Math.floor(min / 60);
  if (h < 24) return `من ${h} ساعة`;
  return `من ${Math.floor(h / 24)} يوم`;
};

/** Four segments, filled up to the current stage. Animated only while the order is live. */
export function MiniProgress({ status }: { status: NonNullable<RecentOrder["status"]> }) {
  const stage = stageOf(status);
  const live = !isTerminal(status);
  return (
    <span className="flex gap-1" role="presentation" aria-hidden>
      {[0, 1, 2, 3].map((i) => {
        const filled = status === "cancelled" ? false : i <= stage;
        const current = live && i === stage;
        return (
          <span
            key={i}
            className={`h-1.5 w-8 rounded-full ${filled ? (status === "delivered" ? "bg-forest" : "bg-ember") : "bg-charcoal/15"} ${current ? "animate-pulse" : ""}`}
          />
        );
      })}
    </span>
  );
}

function OrderRow({ o, onRemove }: { o: RecentOrder; onRemove: () => void }) {
  const done = o.status && isTerminal(o.status);
  return (
    <li data-track-order={o.code} data-status={o.status ?? "unknown"} className={`flex items-center gap-3 py-3 ${done ? "opacity-75" : ""}`}>
      <Link href={`/order/${o.code}`} className="min-w-0 flex-1" aria-label={`تتبع الطلب ${o.code}`}>
        <span className="flex items-baseline gap-3">
          <span className="font-display text-3xl tracking-widest text-ember" dir="ltr">
            {o.code}
          </span>
          <span className="text-sm text-charcoal/70">
            {ago(o.at)} · {formatMoney(o.total)} {ar.currency}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span data-testid="order-status" className={`font-medium ${o.status === "cancelled" ? "text-charcoal/70" : "text-forest"}`}>
            {o.status ? statusLabel(o.status, o.fulfillment) : "بنجيب حالة الطلب…"}
          </span>
          {o.status && <MiniProgress status={o.status} />}
        </span>
      </Link>
      <Link href={`/order/${o.code}`} className={`grid h-11 shrink-0 place-items-center rounded-full px-5 font-medium ${done ? "border-2 border-forest text-forest" : "bg-forest text-ivory"}`}>
        تتبع
      </Link>
      <button onClick={onRemove} aria-label={`شيل ${o.code} من القائمة`} className="grid size-11 shrink-0 place-items-center text-xl text-charcoal/70">
        ×
      </button>
    </li>
  );
}

/** "عندك كود طلب؟": for a customer on a new phone. Same rate limits apply to the lookup. */
export function TrackByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.trim().toUpperCase();
  const valid = /^[A-HJ-NP-Z2-9]{6}$/.test(clean);

  return (
    <form
      className="mt-6 rounded-2xl bg-forest/10 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/order/${clean}`);
      }}
    >
      <label htmlFor="track-code" className="font-display text-2xl text-forest">
        عندك كود طلب؟
      </label>
      <p className="text-sm text-charcoal/70">لو طلبت من موبايل تاني، اكتب الكود (6 حروف وأرقام) وتابع طلبك.</p>
      <div className="mt-2 flex gap-2">
        <input
          id="track-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
          placeholder="ABC234"
          className="h-12 min-w-0 flex-1 rounded-xl border-2 border-charcoal/20 bg-white px-3 text-center font-display text-2xl tracking-widest outline-none focus:border-forest"
        />
        <button type="submit" disabled={!valid} className="h-12 shrink-0 rounded-full bg-forest px-6 font-medium text-ivory disabled:opacity-40">
          تابع الطلب
        </button>
      </div>
    </form>
  );
}

/** The "تتبع طلبك" block: this device's recent orders with live status, and the code field. */
export function TrackSection({ limit = 3, as = "section" }: { limit?: number; as?: "section" | "page" }) {
  const { orders, ready } = useOrderStatus();
  // live orders first, then the most recent finished ones
  const rows = [...orders].sort((a, b) => Number(!!b.status && !isTerminal(b.status)) - Number(!!a.status && !isTerminal(a.status)) || b.at - a.at).slice(0, limit);

  return (
    <section className="mx-auto max-w-xl px-5" aria-labelledby="track-h" data-testid="track-section">
      <Reveal>
        {as === "page" ? (
          <h1 id="track-h" className="font-display text-5xl text-forest">
            تتبع طلبك
          </h1>
        ) : (
          <h2 id="track-h" className="font-display text-4xl text-forest">
            تتبع طلبك
          </h2>
        )}
        <div className="sadu mt-1 h-2 w-32 text-leaf" aria-hidden />
      </Reveal>

      {ready && rows.length === 0 && (
        <p className="mt-4 text-charcoal/75">أول ما تطلب هتلاقي طلبك هنا وتتابعه خطوة بخطوة.</p>
      )}
      {rows.length > 0 && (
        <ul className="mt-2 divide-y divide-charcoal/10" aria-live="polite">
          {rows.map((o) => (
            <OrderRow key={o.code} o={o} onRemove={() => removeRecentOrder(o.code)} />
          ))}
        </ul>
      )}
      <TrackByCode />
    </section>
  );
}

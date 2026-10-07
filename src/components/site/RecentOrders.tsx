"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readRecentOrders, removeRecentOrder, type RecentOrder } from "@/lib/recent-orders";
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

/** The customer's own recent orders (this device only). Renders nothing when there are none. */
export function RecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  useEffect(() => setOrders(readRecentOrders()), []);
  if (orders.length === 0) return null;

  return (
    <section className="mx-auto max-w-xl px-5 pt-16" aria-labelledby="recent-h">
      <h2 id="recent-h" className="font-display text-3xl text-forest">
        طلباتك الأخيرة
      </h2>
      <ul className="mt-3 divide-y divide-charcoal/10">
        {orders.slice(0, 3).map((o) => (
          <li key={o.code} className="flex items-center justify-between gap-3 py-3">
            <Link href={`/order/${o.code}`} className="flex flex-1 items-baseline gap-3">
              <span className="font-display text-3xl tracking-widest text-ember" dir="ltr">
                {o.code}
              </span>
              <span className="text-sm text-charcoal/65">
                {ago(o.at)} · {formatMoney(o.total)} {ar.currency}
              </span>
            </Link>
            <Link href={`/order/${o.code}`} className="grid h-11 place-items-center rounded-full bg-forest px-5 text-ivory">
              تابع
            </Link>
            <button
              onClick={() => {
                removeRecentOrder(o.code);
                setOrders(readRecentOrders());
              }}
              aria-label={`شيل ${o.code} من القائمة`}
              className="grid size-11 place-items-center text-charcoal/50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "عندك كود طلب؟": opens tracking for a code typed by hand (e.g. on a new phone). */
export function TrackByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.trim().toUpperCase();
  const valid = /^[A-HJ-NP-Z2-9]{6}$/.test(clean);

  return (
    <form
      className="mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) router.push(`/order/${clean}`);
      }}
    >
      <label htmlFor="track-code" className="font-display text-2xl text-forest">
        عندك كود طلب؟
      </label>
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
          className="h-12 w-40 rounded-xl border-2 border-charcoal/20 bg-white px-3 text-center font-display text-2xl tracking-widest outline-none focus:border-forest"
        />
        <button type="submit" disabled={!valid} className="h-12 rounded-full bg-forest px-6 text-ivory disabled:opacity-40">
          تابع الطلب
        </button>
      </div>
    </form>
  );
}

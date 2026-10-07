"use client";

import { useEffect, useState } from "react";
import type { DailySummary } from "@/lib/server/summary";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

export function SummaryPanel() {
  const [s, setS] = useState<DailySummary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/staff/summary", { cache: "no-store" });
        if (!r.ok) throw new Error();
        if (alive) {
          setS(await r.json());
          setErr(false);
        }
      } catch {
        if (alive) setErr(true);
      }
    };
    void load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (err && !s) return <p className="py-10 text-center text-ember">مقدرناش نجيب الملخص. حاول تاني.</p>;
  if (!s) return <p className="py-10 text-center text-charcoal/60">بنحسب ملخص النهارده…</p>;

  const stat = (label: string, value: string, tone = "text-forest") => (
    <div className="rounded-2xl bg-white p-4">
      <dt className="text-sm text-charcoal/65">{label}</dt>
      <dd className={`font-display text-4xl ${tone}`}>{value}</dd>
    </div>
  );

  return (
    <section aria-label="ملخص اليوم" data-testid="summary">
      <p className="text-charcoal/70">{s.date}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        {stat("عدد الطلبات", String(s.orders))}
        {stat("اتسلم", String(s.delivered))}
        {stat("الإيراد", `${formatMoney(s.revenue)} ${ar.currency}`, "text-ember")}
        {stat("لسه شغال", `${formatMoney(s.pending)} ${ar.currency}`, "text-charcoal")}
        {stat("مطعم (اتسلم)", `${formatMoney(s.restaurantRevenue)}`)}
        {stat("جزارة (اتسلم)", `${formatMoney(s.butcherRevenue)}`)}
      </dl>
      {s.cancelled > 0 && <p className="mt-2 text-sm text-charcoal/60">طلبات ملغية: {s.cancelled}</p>}
      <h2 className="mt-6 font-display text-2xl">الأكتر مبيعًا</h2>
      {s.topItems.length === 0 ? (
        <p className="py-4 text-charcoal/60">لسه مفيش طلبات النهارده.</p>
      ) : (
        <ol className="mt-2 divide-y divide-charcoal/10 rounded-2xl bg-white px-4">
          {s.topItems.map((t, i) => (
            <li key={t.name} className="flex items-baseline justify-between py-3">
              <span>
                <span className="me-2 font-display text-xl text-ember">{i + 1}</span>
                {t.name}
                <span className="ms-2 text-sm text-charcoal/60">{t.unit === "kg" ? formatKg(t.qty) : `×${t.qty}`}</span>
              </span>
              <span className="tabular-nums">{formatMoney(t.revenue)} {ar.currency}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-xs text-charcoal/50">الإيراد = الطلبات اللي اتسلمت النهارده (بتوقيت القاهرة)، بالسعر النهائي بعد الوزن.</p>
    </section>
  );
}

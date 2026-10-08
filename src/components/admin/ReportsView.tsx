"use client";

import { useState } from "react";
import Link from "next/link";
import type { DayPoint, Report } from "@/lib/server/reports";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

// Validated pair (scripts/validate_palette.js, light): normal-vision dE 27.8, colour-blind dE 9.2, contrast >= 3:1
const RESTAURANT = "#35a35f";
const BUTCHER = "#c2410c";
const GRID = "rgba(30,27,24,0.12)";

const fullDate = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long" });
const shortDate = (key: string) => {
  const [, m, d] = key.split("-").map(Number);
  return `${d}/${m}`;
};

/** A "nice" top for the y axis: 1, 2, 5 x 10^n. */
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

interface Bar { label: string; value: number; title: string; detail: string }

function BarChart({ bars, fmt, name }: { bars: Bar[]; fmt: (v: number) => string; name: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Drawn at roughly phone width so the 11px labels stay about 11px on screen (it scales up on wider screens).
  const W = 360, H = 190, L = 44, R = 6, T = 14, B = 26;
  const innerW = W - L - R, innerH = H - T - B;
  const max = niceMax(Math.max(...bars.map((b) => b.value), 0));
  const slot = innerW / bars.length;
  const bw = Math.min(26, slot * 0.7);
  const every = bars.length <= 10 ? 1 : Math.ceil(bars.length / 8);
  const y = (v: number) => T + innerH - (v / max) * innerH;
  const top = bars.reduce((m, b, i) => (b.value > bars[m].value ? i : m), 0);

  return (
    <div className="relative" dir="ltr">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={name} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} stroke={GRID} strokeWidth="1" />
            <text x={L - 6} y={y(max * t) + 4} textAnchor="end" fontSize="11" fill="rgba(30,27,24,0.65)">
              {fmt(max * t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const x = L + slot * i + (slot - bw) / 2;
          const h = Math.max(b.value > 0 ? 2 : 0, (b.value / max) * innerH);
          const r = Math.min(4, h / 2, bw / 2);
          return (
            <g key={i} onPointerEnter={() => setHover(i)} onPointerMove={() => setHover(i)}>
              <rect x={L + slot * i} y={T} width={slot} height={innerH} fill="transparent" /> {/* wide hit target */}
              {b.value > 0 && (
                <path
                  d={`M${x} ${T + innerH} V${T + innerH - h + r} Q${x} ${T + innerH - h} ${x + r} ${T + innerH - h} H${x + bw - r} Q${x + bw} ${T + innerH - h} ${x + bw} ${T + innerH - h + r} V${T + innerH} Z`}
                  fill={RESTAURANT}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {i % every === 0 && (
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="rgba(30,27,24,0.65)">
                  {b.label}
                </text>
              )}
            </g>
          );
        })}
        {/* one direct label: the best period */}
        {bars[top].value > 0 && (
          <text x={L + slot * top + slot / 2} y={y(bars[top].value) - 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="#1e1b18">
            {fmt(bars[top].value)}
          </text>
        )}
      </svg>
      {hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-charcoal px-3 py-2 text-sm text-ivory shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, ((L + slot * hover + slot / 2) / W) * 100))}%` }}
          dir="rtl"
        >
          <p className="font-bold">{bars[hover].title}</p>
          <p>{bars[hover].detail}</p>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4">
      <dt className="text-sm text-charcoal/70">{label}</dt>
      <dd className="font-display text-4xl leading-tight text-forest">{value}</dd>
      {sub && <dd className="text-xs text-charcoal/70">{sub}</dd>}
    </div>
  );
}

export function ReportsView({ report }: { report: Report }) {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [table, setTable] = useState(false);
  const rows: DayPoint[] = view === "daily" ? report.daily : report.weekly;
  const t = report.totals;
  const splitTotal = report.split.restaurant + report.split.butcher;
  const pct = (v: number) => (splitTotal ? Math.round((v / splitTotal) * 100) : 0);
  const topMax = Math.max(...report.topItems.map((i) => i.revenue), 1);

  const label = (p: DayPoint) => (view === "daily" ? shortDate(p.key) : shortDate(p.key));
  const title = (p: DayPoint) => (view === "daily" ? fullDate(p.key) : `أسبوع من ${fullDate(p.key)}`);
  const orderBars: Bar[] = rows.map((p) => ({ label: label(p), value: p.orders, title: title(p), detail: `${p.orders} طلب · ${p.delivered} اتسلم${p.cancelled ? ` · ${p.cancelled} ملغي` : ""}` }));
  const revBars: Bar[] = rows.map((p) => ({ label: label(p), value: p.revenue, title: title(p), detail: `${formatMoney(p.revenue)} ${ar.currency}` }));

  return (
    <div>
      <h1 className="font-display text-4xl text-forest">التقارير</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="الفترة" className="flex gap-1 rounded-full bg-forest/10 p-1">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={`/admin/reports?days=${d}`} aria-current={report.days === d ? "true" : undefined} className={`grid h-11 place-items-center rounded-full px-4 ${report.days === d ? "bg-forest text-ivory" : "text-forest"}`}>
              {d === 7 ? "آخر 7 أيام" : d === 30 ? "آخر 30 يوم" : "آخر 90 يوم"}
            </Link>
          ))}
        </div>
        <div role="group" aria-label="التجميع" className="flex gap-1 rounded-full bg-forest/10 p-1">
          {(["daily", "weekly"] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`h-11 rounded-full px-4 ${view === v ? "bg-forest text-ivory" : "text-forest"}`}>
              {v === "daily" ? "يومي" : "أسبوعي"}
            </button>
          ))}
        </div>
        <button aria-pressed={table} onClick={() => setTable((x) => !x)} className="h-11 rounded-full border-2 border-forest px-4 text-forest">
          {table ? "عرض الرسم" : "عرض كجدول"}
        </button>
      </div>
      <p className="mt-2 text-sm text-charcoal/70">بتوقيت القاهرة. الإيراد = الطلبات اللي اتسلمت، بالسعر النهائي بعد وزن اللحوم. الطلبات الملغية مش محسوبة.</p>

      <dl className="mt-4 grid grid-cols-2 gap-3" data-testid="report-totals">
        <Tile label="عدد الطلبات" value={String(t.orders)} sub={t.cancelled ? `+ ${t.cancelled} ملغي` : undefined} />
        <Tile label="الإيراد" value={`${formatMoney(t.revenue)}`} sub={`${ar.currency} من ${t.delivered} طلب اتسلم`} />
        <Tile label="متوسط الطلب" value={`${formatMoney(t.avgOrder)}`} sub={ar.currency} />
        <Tile label="لسه شغال" value={String(t.inProgress)} sub="طلب مش متسلم" />
      </dl>

      {table ? (
        <div className="mt-5 overflow-x-auto rounded-2xl bg-white p-3">
          <table className="w-full text-start" data-testid="report-table">
            <caption className="mb-2 text-start font-display text-xl">{view === "daily" ? "الطلبات والإيراد باليوم" : "الطلبات والإيراد بالأسبوع"}</caption>
            <thead>
              <tr className="border-b-2 border-charcoal/20 text-sm text-charcoal/70">
                <th className="py-2 text-start font-medium">{view === "daily" ? "اليوم" : "أسبوع من"}</th>
                <th className="py-2 text-start font-medium">طلبات</th>
                <th className="py-2 text-start font-medium">اتسلم</th>
                <th className="py-2 text-start font-medium">ملغي</th>
                <th className="py-2 text-start font-medium">الإيراد</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((p) => (
                <tr key={p.key} className="border-b border-charcoal/10 tabular-nums">
                  <td className="py-2">{fullDate(p.key)}</td>
                  <td>{p.orders}</td>
                  <td>{p.delivered}</td>
                  <td>{p.cancelled}</td>
                  <td>{formatMoney(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <section className="mt-5 rounded-2xl bg-white p-4" aria-label="الطلبات">
            <h2 className="font-display text-2xl">الطلبات {view === "daily" ? "باليوم" : "بالأسبوع"}</h2>
            <BarChart bars={orderBars} fmt={(v) => String(Math.round(v))} name="عدد الطلبات" />
          </section>
          <section className="mt-4 rounded-2xl bg-white p-4" aria-label="الإيراد">
            <h2 className="font-display text-2xl">الإيراد {view === "daily" ? "باليوم" : "بالأسبوع"} ({ar.currency})</h2>
            <BarChart bars={revBars} fmt={(v) => formatMoney(Math.round(v))} name="الإيراد" />
          </section>
        </>
      )}

      <section className="mt-4 rounded-2xl bg-white p-4" aria-label="المطعم والجزارة">
        <h2 className="font-display text-2xl">المطعم والجزارة</h2>
        {splitTotal === 0 ? (
          <p className="py-3 text-charcoal/70">لسه مفيش طلبات اتسلمت في الفترة دي.</p>
        ) : (
          <>
            <div className="mt-3 flex h-9 gap-[2px] overflow-hidden rounded-lg" role="img" aria-label={`المطعم ${pct(report.split.restaurant)}% والجزارة ${pct(report.split.butcher)}%`} dir="ltr">
              <div style={{ width: `${(report.split.restaurant / splitTotal) * 100}%`, background: RESTAURANT }} />
              <div style={{ width: `${(report.split.butcher / splitTotal) * 100}%`, background: BUTCHER }} />
            </div>
            <ul className="mt-3 space-y-2">
              {[
                ["المطعم", report.split.restaurant, RESTAURANT],
                ["الجزارة", report.split.butcher, BUTCHER],
              ].map(([name, v, color]) => (
                <li key={name as string} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-3.5 rounded-sm" style={{ background: color as string }} />
                    {name as string}
                  </span>
                  <span className="tabular-nums">
                    <b>{formatMoney(v as number)}</b> {ar.currency} · {pct(v as number)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white p-4" aria-label="الأكتر مبيعًا">
        <h2 className="font-display text-2xl">الأكتر مبيعًا</h2>
        {report.topItems.length === 0 ? (
          <p className="py-3 text-charcoal/70">لسه مفيش طلبات في الفترة دي.</p>
        ) : (
          <ol className="mt-2 space-y-3" data-testid="top-items">
            {report.topItems.map((i, idx) => (
              <li key={i.name}>
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="me-2 font-display text-xl text-ember">{idx + 1}</span>
                    {i.name}
                    <span className="ms-2 text-sm text-charcoal/70">{i.unit === "kg" ? formatKg(i.qty) : `×${i.qty}`}</span>
                  </span>
                  <span className="tabular-nums">{formatMoney(i.revenue)} {ar.currency}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-charcoal/10" dir="ltr">
                  <div className="h-2 rounded-full" style={{ width: `${(i.revenue / topMax) * 100}%`, background: RESTAURANT }} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

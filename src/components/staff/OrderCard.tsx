"use client";

import type { BoardOrder } from "@/lib/staff-types";
import { waLink } from "@/lib/staff-types";
import type { OrderStatus } from "@/lib/tracking-types";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

export function ago(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (min < 1) return "دلوقتي";
  if (min < 60) return `من ${min} دقيقة`;
  const h = Math.floor(min / 60);
  return h < 24 ? `من ${h} ساعة` : "من أكتر من يوم";
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "جديد",
  accepted: "اتقبل",
  preparing: "بيتجهز",
  out_for_delivery: "خرج / جاهز",
  delivered: "اتسلم",
  cancelled: "ملغي",
};

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "accepted",
  accepted: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
};

function nextLabel(o: BoardOrder): string {
  switch (o.status) {
    case "new":
      return "قبول الطلب";
    case "accepted":
      return "ابدأ التجهيز";
    case "preparing":
      return o.fulfillment === "pickup" ? "جاهز للاستلام" : "خرج للتوصيل";
    case "out_for_delivery":
      return "تم التسليم";
    default:
      return "";
  }
}

export const needsWeighing = (o: BoardOrder) => o.order_items.some((i) => i.kind === "butcher" && i.qty_final === null);

interface Props {
  order: BoardOrder;
  now: number;
  fresh: boolean;
  busy: boolean;
  onAdvance: (o: BoardOrder, to: OrderStatus) => void;
  onMute: (o: BoardOrder) => void;
  onCancel: (o: BoardOrder) => void;
  onWeigh: (o: BoardOrder) => void;
}

export function OrderCard({ order: o, now, fresh, busy, onAdvance, onMute, onCancel, onWeigh }: Props) {
  const next = NEXT[o.status];
  const weighFirst = needsWeighing(o) && (next === "out_for_delivery" || next === "delivered");
  const alarming = o.status === "new" && !o.acknowledged_at;
  const finished = o.status === "delivered" || o.status === "cancelled";
  const addr = o.address_json;
  const final = o.total_final;

  return (
    <article
      data-order-code={o.code}
      data-status={o.status}
      className={`rounded-2xl border-2 bg-white p-4 shadow-sm transition-colors duration-1000 ${
        alarming ? "border-ember" : "border-charcoal/10"
      } ${fresh ? "bg-saffron/25" : ""} ${o.status === "cancelled" ? "opacity-75" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-4xl leading-none tracking-widest text-ember" dir="ltr">
            {o.code}
          </p>
          <p className="mt-1 text-sm text-charcoal/65">{ago(o.created_at, now)}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5 text-sm font-medium">
          <span className="rounded-full bg-forest px-3 py-1 text-ivory">{o.fulfillment === "delivery" ? "توصيل" : "استلام"}</span>
          {o.has_restaurant && <span className="rounded-full bg-saffron px-3 py-1 text-charcoal">مطعم</span>}
          {o.has_butcher && <span className="rounded-full bg-ember px-3 py-1 text-ivory">جزارة</span>}
          {finished && <span className="rounded-full bg-charcoal/15 px-3 py-1">{STATUS_LABEL[o.status]}</span>}
        </div>
      </header>

      <section className="mt-3 rounded-xl bg-charcoal/5 p-3">
        <p className="text-lg font-bold">{o.customer_name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`tel:${o.phone}`} className="inline-flex h-11 items-center rounded-full bg-forest px-4 text-ivory" dir="ltr">
            {o.phone}
          </a>
          <a href={waLink(o.phone, `أهلاً ${o.customer_name}، بخصوص طلبك رقم ${o.code} من كباش`)} className="inline-flex h-11 items-center rounded-full border-2 border-forest px-4 text-forest">
            واتساب
          </a>
        </div>
        {o.fulfillment === "delivery" && addr && (
          <p className="mt-2">
            <b>{o.zone_name}</b>
            {addr.street ? ` — ${addr.street}` : ""}
            {addr.building ? `، عمارة/شقة ${addr.building}` : ""}
            {addr.landmark ? `، جنب ${addr.landmark}` : ""}
          </p>
        )}
      </section>

      {o.notes && (
        <p className="mt-3 rounded-xl bg-saffron/40 p-3 font-medium">
          ملاحظات: {o.notes}
        </p>
      )}

      <ul className="mt-3 divide-y divide-charcoal/10">
        {o.order_items.length === 0 && <li className="py-2 text-charcoal/60">بيتحمّل الأصناف…</li>}
        {o.order_items.map((i) => {
          const snap = i.variant_snapshot;
          const weighed = i.kind === "butcher" && i.qty_final !== null;
          return (
            <li key={i.id} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg">
                  <b>{i.unit === "kg" ? formatKg(i.qty_requested) : `×${i.qty_requested}`}</b> {i.name_snapshot}
                  {snap?.variant?.name ? <span className="text-charcoal/70"> · {snap.variant.name}</span> : null}
                </span>
                <span className="tabular-nums">
                  {weighed ? (
                    <>
                      <s className="me-2 text-sm text-charcoal/50">{formatMoney(i.line_total_estimate)}</s>
                      <b className="text-forest">{formatMoney(i.line_total_final ?? 0)}</b>
                    </>
                  ) : (
                    formatMoney(i.line_total_estimate)
                  )}
                </span>
              </div>
              {snap?.extras && snap.extras.length > 0 && (
                <p className="text-sm text-charcoal/70">+ {snap.extras.map((e) => e.name).join("، ")}</p>
              )}
              {i.kind === "butcher" && (
                <p className={`text-sm ${weighed ? "text-forest" : "font-medium text-ember"}`}>
                  {weighed ? `الوزن الفعلي ${formatKg(i.qty_final!)}` : "لسه متوزنش"}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-2 space-y-0.5 border-t border-dashed border-charcoal/25 pt-2">
        {o.discount_total > 0 && (
          <div className="flex justify-between text-forest">
            <dt>خصم</dt>
            <dd><span dir="ltr">−{formatMoney(o.discount_total)}</span> {ar.currency}</dd>
          </div>
        )}
        {o.fulfillment === "delivery" && (
          <div className="flex justify-between">
            <dt>توصيل</dt>
            <dd>{formatMoney(o.delivery_fee)} {ar.currency}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between font-display text-2xl text-forest">
          <dt>{final !== null ? "الإجمالي النهائي" : o.has_butcher ? "الإجمالي (تقديري)" : "الإجمالي"}</dt>
          <dd>{formatMoney(final ?? o.total_estimate)} {ar.currency}</dd>
        </div>
        {final !== null && final !== o.total_estimate && (
          <div className="flex justify-between text-sm text-charcoal/60">
            <dt>كان تقديريًا</dt>
            <dd className="line-through">{formatMoney(o.total_estimate)}</dd>
          </div>
        )}
        <p className="text-sm text-charcoal/60">كاش عند الاستلام</p>
      </dl>

      {o.status === "cancelled" && o.cancel_reason && <p className="mt-2 text-sm text-ember">سبب الإلغاء: {o.cancel_reason}</p>}

      <footer className="mt-4 flex flex-wrap gap-2">
        {!finished && next && (
          <button
            disabled={busy}
            onClick={() => (weighFirst ? onWeigh(o) : onAdvance(o, next))}
            className={`h-14 min-w-40 flex-1 rounded-full font-display text-2xl text-ivory transition active:scale-[0.98] disabled:opacity-50 ${
              weighFirst ? "bg-saffron !text-charcoal" : "bg-ember"
            }`}
          >
            {weighFirst ? "وزّن اللحمة الأول" : nextLabel(o)}
          </button>
        )}
        {alarming && (
          <button disabled={busy} onClick={() => onMute(o)} className="h-14 rounded-full border-2 border-charcoal/30 px-5">
            كتم الصوت
          </button>
        )}
        {!finished && o.has_butcher && !weighFirst && (
          <button disabled={busy} onClick={() => onWeigh(o)} className="h-12 rounded-full border-2 border-forest px-5 text-forest">
            تعديل الوزن
          </button>
        )}
        <a
          href={`/staff/orders/${o.id}/slip`}
          target="_blank"
          rel="noopener"
          className="grid h-12 place-items-center rounded-full border-2 border-charcoal/30 px-5"
        >
          طباعة
        </a>
        {!finished && (
          <button disabled={busy} onClick={() => onCancel(o)} className="h-12 rounded-full px-4 text-ember underline">
            إلغاء الطلب
          </button>
        )}
      </footer>
    </article>
  );
}

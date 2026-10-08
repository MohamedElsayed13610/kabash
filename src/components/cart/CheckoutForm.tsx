"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "./CartProvider";
import { RollingNumber } from "../ui/RollingNumber";
import { orderSchema } from "@/lib/validation/order";
import { addRecentOrder } from "@/lib/recent-orders";
import type { OrderTotals } from "@/lib/pricing/order";
import { ar } from "@/messages/ar";
import { formatKg, formatMoney } from "@/lib/format";

export interface ZoneOption {
  id: string;
  name_ar: string;
  fee: number;
  min_order: number;
  eta_minutes: number | null;
}

interface QuoteState {
  totals: OrderTotals;
  canOrder: boolean;
  open: boolean;
  freeDeliveryThreshold: number | null;
}

const CUSTOMER_KEY = "kabash.customer.v1";

const inputCls =
  "h-14 w-full rounded-xl border-2 border-charcoal/20 bg-white px-4 text-lg outline-none focus:border-forest aria-[invalid=true]:border-ember";

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-ember">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({ zones }: { zones: ZoneOption[] }) {
  const router = useRouter();
  const { lines, hydrated, clear } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [zoneId, setZoneId] = useState("");
  const [street, setStreet] = useState("");
  const [building, setBuilding] = useState("");
  const [landmark, setLandmark] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitted = useRef(false);

  // Remembered customer details (this device only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "null");
      if (!saved) return;
      setName(saved.name ?? "");
      setPhone(saved.phone ?? "");
      setStreet(saved.street ?? "");
      setBuilding(saved.building ?? "");
      setLandmark(saved.landmark ?? "");
      if (saved.fulfillment === "pickup" || saved.fulfillment === "delivery") setFulfillment(saved.fulfillment);
      if (zones.some((z) => z.id === saved.zoneId)) setZoneId(saved.zoneId);
    } catch {
      /* ignore corrupted storage */
    }
  }, [zones]);

  const payloadLines = useMemo(
    () => lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, extraIds: l.extraIds, qty: l.qty })),
    [lines],
  );

  // Ask the server what this cart costs. The browser never computes a price that is saved.
  useEffect(() => {
    if (!hydrated || lines.length === 0) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const asPickup = fulfillment === "pickup" || !zoneId;
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fulfillment: asPickup ? "pickup" : "delivery", zoneId: asPickup ? null : zoneId, lines: payloadLines }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          setQuote(null);
          setQuoteError(json.error?.message ?? "مقدرناش نحسب الإجمالي.");
          return;
        }
        setQuoteError(null);
        setQuote(json);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuoteError("مفيش اتصال بالإنترنت. اتأكد من الشبكة.");
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [hydrated, lines.length, payloadLines, fulfillment, zoneId, zones.length]);

  const zone = zones.find((z) => z.id === zoneId);
  const totals = quote?.totals;
  const needsZone = fulfillment === "delivery" && !zoneId;
  const closed = quote ? !quote.canOrder : false;
  const hasButcher = lines.some((l) => l.unit === "kg");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || submitted.current) return;
    setFormError(null);

    const body = {
      name,
      phone,
      fulfillment,
      zoneId: fulfillment === "delivery" ? zoneId || null : null,
      address: { street, building, landmark },
      notes,
      payment: "cash" as const,
      lines: payloadLines,
      website,
    };
    const check = orderSchema.safeParse(body);
    if (!check.success) {
      const fe: Record<string, string> = {};
      for (const i of check.error.issues) fe[i.path.join(".")] ??= i.message;
      setErrors(fe);
      document.getElementById(Object.keys(fe)[0]?.replace(".", "-") ?? "")?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.error?.fields ?? {});
        setFormError(json.error?.message ?? "مقدرناش نبعت الطلب. جرب تاني.");
        setBusy(false);
        return;
      }
      submitted.current = true;
      try {
        localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name, phone, street, building, landmark, fulfillment, zoneId }));
      } catch {
        /* storage blocked */
      }
      addRecentOrder(json.code, json.total);
      clear();
      router.push(`/order/${json.code}`);
    } catch {
      setFormError("مفيش اتصال بالإنترنت. اتأكد من الشبكة وجرب تاني.");
      setBusy(false);
    }
  }

  if (!hydrated) return <div className="min-h-[60dvh]" />;

  if (lines.length === 0 && !submitted.current) {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <h1 className="font-display text-4xl text-forest">الصينية فاضية</h1>
        <p className="mt-2 text-charcoal/75">لسه مختارتش حاجة. المنيو مستنيك.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/menu" className="grid h-12 place-items-center rounded-full bg-ember px-7 font-display text-xl text-ivory">
            المنيو
          </Link>
          <Link href="/butcher" className="grid h-12 place-items-center rounded-full border-2 border-forest px-7 font-display text-xl text-forest">
            الجزارة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto max-w-xl px-5 pb-40 pt-8">
      <h1 className="font-display text-5xl text-forest">كمّل طلبك</h1>

      {closed && (
        <p role="alert" className="mt-4 rounded-xl bg-saffron p-4 font-medium text-charcoal">
          {ar.closed.title}. مش هنقدر نستقبل الطلب دلوقتي، ارجع لنا أول ما نفتح.
        </p>
      )}

      {/* hidden from people, visible to bots */}
      <div aria-hidden className="absolute -start-[9999px]">
        <label>
          الموقع
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>

      <section className="mt-6 space-y-4" aria-label="بياناتك">
        <Field label="الاسم" htmlFor="name" error={errors.name}>
          <input id="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errors.name} />
        </Field>
        <Field label="رقم الموبايل" htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            className={inputCls}
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01012345678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={!!errors.phone}
            style={{ textAlign: "start" }}
          />
        </Field>
      </section>

      <section className="mt-8" aria-label="الاستلام">
        <div role="radiogroup" aria-label="طريقة الاستلام" className="grid grid-cols-2 gap-2 rounded-full bg-forest/10 p-1">
          {(["delivery", "pickup"] as const).map((f) => (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="fulfillment" className="peer sr-only" checked={fulfillment === f} onChange={() => setFulfillment(f)} />
              <span className="grid h-12 place-items-center rounded-full font-display text-xl text-forest peer-checked:bg-forest peer-checked:text-ivory peer-focus-visible:outline-3 peer-focus-visible:outline-saffron">
                {f === "delivery" ? "توصيل" : "استلام من المحل"}
              </span>
            </label>
          ))}
        </div>

        {fulfillment === "delivery" ? (
          <div className="mt-4 space-y-4">
            <Field label="المنطقة" htmlFor="zoneId" error={errors.zoneId}>
              <select
                id="zoneId"
                className={inputCls}
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                aria-invalid={!!errors.zoneId}
              >
                <option value="">اختار منطقتك</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name_ar} — توصيل {formatMoney(z.fee)} {ar.currency}
                  </option>
                ))}
              </select>
              {zone && (
                <p className="mt-1 text-sm text-charcoal/70">
                  {zone.eta_minutes ? `التوصيل حوالي ${zone.eta_minutes} دقيقة. ` : ""}
                  {zone.min_order > 0 ? `الحد الأدنى للطلب ${formatMoney(zone.min_order)} ${ar.currency}.` : ""}
                </p>
              )}
              {zones.length === 0 && <p className="mt-1 text-sm text-ember">مفيش مناطق توصيل متاحة دلوقتي. تقدر تستلم من المحل.</p>}
            </Field>
            <Field label="الشارع / العنوان" htmlFor="address-street" error={errors["address.street"]}>
              <input id="address-street" className={inputCls} value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="street-address" aria-invalid={!!errors["address.street"]} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="العمارة / الشقة" htmlFor="address-building">
                <input id="address-building" className={inputCls} value={building} onChange={(e) => setBuilding(e.target.value)} />
              </Field>
              <Field label="علامة مميزة" htmlFor="address-landmark">
                <input id="address-landmark" className={inputCls} value={landmark} onChange={(e) => setLandmark(e.target.value)} />
              </Field>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-forest/10 p-4">هتستلم طلبك من: {ar.address}</p>
        )}
      </section>

      <section className="mt-8 space-y-4">
        <Field label="ملاحظات (اختياري)" htmlFor="notes" error={errors.notes}>
          <textarea id="notes" rows={3} maxLength={300} className={`${inputCls} h-auto py-3`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div>
          <p className="mb-1 font-medium">الدفع</p>
          <label className="flex h-14 items-center gap-3 rounded-xl border-2 border-forest bg-forest/5 px-4">
            <input type="radio" checked readOnly aria-label="كاش عند الاستلام" className="size-5 accent-forest" />
            <span>كاش عند الاستلام</span>
          </label>
        </div>
      </section>

      {/* receipt */}
      <section className="mt-10 border-y-2 border-dashed border-charcoal/25 py-5" aria-label="ملخص الطلب">
        <h2 className="font-display text-3xl">الصينية</h2>
        <ul className="mt-2 divide-y divide-charcoal/10">
          {(totals?.lines ?? []).map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                {l.name}
                <span className="ms-2 text-sm text-charcoal/70">
                  {l.unit === "kg" ? formatKg(l.qty) : `×${l.qty}`}
                  {l.variant ? ` · ${l.variant.name}` : ""}
                </span>
                {l.offerTitles.length > 0 && <span className="block text-sm text-forest">{l.offerTitles[0]}</span>}
              </span>
              <span className="tabular-nums">{formatMoney(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {!totals && !quoteError && <p className="py-4 text-charcoal/70">بنحسب الإجمالي…</p>}
        {quoteError && (
          <p role="alert" className="py-3 font-medium text-ember">
            {quoteError}
          </p>
        )}
        {totals && (
          <dl className="mt-3 space-y-1">
            <div className="flex justify-between">
              <dt>الأصناف</dt>
              <dd className="tabular-nums">{formatMoney(totals.subtotal)} {ar.currency}</dd>
            </div>
            {totals.discountTotal > 0 && (
              <div className="flex justify-between text-forest">
                <dt>الخصم</dt>
                <dd className="tabular-nums">
                  <span dir="ltr">−{formatMoney(totals.discountTotal)}</span> {ar.currency}
                </dd>
              </div>
            )}
            {fulfillment === "delivery" && (
              <div className="flex justify-between">
                <dt>التوصيل</dt>
                <dd className="tabular-nums">
                  {needsZone ? "اختار المنطقة" : totals.freeDelivery ? "مجاني" : `${formatMoney(totals.deliveryFee)} ${ar.currency}`}
                </dd>
              </div>
            )}
            {fulfillment === "delivery" && !totals.freeDelivery && quote?.freeDeliveryThreshold != null && (
              <p className="text-sm text-forest">
                التوصيل ببلاش لو طلبك {formatMoney(Number(quote.freeDeliveryThreshold))} {ar.currency} أو أكتر.
              </p>
            )}
          </dl>
        )}
        {hasButcher && <p className="mt-3 text-sm text-charcoal/70">{ar.butcher.estimateNote} هنكلمك لو في أي فرق.</p>}
      </section>

      {formError && (
        <p role="alert" className="mt-4 rounded-xl bg-ember/10 p-4 font-medium text-ember">
          {formError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-ivory px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="submit"
          disabled={busy || closed || !totals}
          className="mx-auto flex h-14 w-full max-w-xl items-center justify-between rounded-full bg-ember px-6 text-ivory transition active:scale-[0.98] disabled:bg-charcoal/35"
        >
          <span className="font-display text-2xl">{busy ? "بنبعت الطلب…" : "ابعت الطلب"}</span>
          {totals && (
            <span className="flex items-baseline gap-1">
              <RollingNumber value={formatMoney(totals.total)} className="font-display text-3xl" />
              <span className="text-sm">{ar.currency}</span>
            </span>
          )}
        </button>
      </div>
    </form>
  );
}

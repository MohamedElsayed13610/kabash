"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Scene, type SceneKey } from "./Scene";
import { RollingNumber } from "../ui/RollingNumber";
import { isTerminal, stageOf, type OrderStatus, type TrackingData } from "@/lib/tracking-types";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

const POLL_MS = 5000;

type Problem = "notfound" | "limited" | "network" | null;

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", hour: "numeric", minute: "2-digit" });

function stepsFor(fulfillment: TrackingData["fulfillment"]) {
  const pickup = fulfillment === "pickup";
  return [
    { title: "استلمنا طلبك", sub: { new: "مستنيين المطعم يأكده", accepted: "المطعم أكد طلبك" } },
    { title: "بنجهز طلبك", sub: null },
    { title: pickup ? "طلبك جاهز للاستلام" : "الطلب في الطريق ليك", sub: null },
    { title: pickup ? "اتسلم، بالهنا والشفا" : "وصل، بالهنا والشفا", sub: null },
  ];
}

function headline(status: OrderStatus, fulfillment: TrackingData["fulfillment"], eta: number | null) {
  switch (status) {
    case "new":
      return { big: "وصلنا طلبك", small: "بنراجعه ونأكده حالًا." };
    case "accepted":
      return { big: "الطلب اتأكد", small: "هنبدأ نجهزه دلوقتي." };
    case "preparing":
      return { big: "بنجهز أكلك", small: eta && fulfillment === "delivery" ? `هيوصلك في حدود ${eta} دقيقة.` : "الأكل على النار." };
    case "out_for_delivery":
      return fulfillment === "pickup"
        ? { big: "طلبك جاهز", small: "تعالى استلمه من المحل." }
        : { big: "الطلب في الطريق", small: "الدليفري ماشي ناحيتك. جهز الكاش." };
    case "delivered":
      return { big: "بالهنا والشفا", small: "نورتنا. اطلب تاني في أي وقت." };
    case "cancelled":
      return { big: "الطلب اتلغى", small: "" };
  }
}

function sceneFor(status: OrderStatus, fulfillment: TrackingData["fulfillment"]): SceneKey {
  switch (status) {
    case "new":
    case "accepted":
      return "received";
    case "preparing":
      return "preparing";
    case "out_for_delivery":
      return fulfillment === "pickup" ? "pickup" : "delivery";
    case "delivered":
      return "delivered";
    case "cancelled":
      return "cancelled";
  }
}

function Timeline({ data }: { data: TrackingData }) {
  const stage = stageOf(data.status);
  const steps = stepsFor(data.fulfillment);
  const timeFor = (k: number) => data.events.find((e) => stageOf(e.status) === k)?.at;
  const progress = stage < 0 ? 0 : stage / (steps.length - 1);

  return (
    <ol className="relative mt-8" aria-label="مراحل الطلب">
      {/* the track, and the fill that grows as the order moves */}
      <span aria-hidden className="absolute bottom-5 start-[1.05rem] top-5 w-1 rounded-full bg-charcoal/15" />
      <motion.span
        aria-hidden
        className="absolute start-[1.05rem] top-5 bottom-5 w-1 origin-top rounded-full bg-forest"
        initial={false}
        animate={{ scaleY: progress }}
        transition={{ type: "spring", damping: 24, stiffness: 120 }}
      />
      {steps.map((s, k) => {
        const done = stage > k || data.status === "delivered";
        const current = stage === k && data.status !== "delivered";
        const at = timeFor(k);
        return (
          <li key={s.title} className="relative flex items-start gap-4 pb-7 last:pb-0" aria-current={current ? "step" : undefined}>
            <motion.span
              initial={false}
              animate={{ scale: current ? 1.15 : 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 300 }}
              className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full border-4 border-ivory font-display text-lg ${
                done ? "bg-forest text-ivory" : current ? "bg-ember text-ivory" : "bg-charcoal/15 text-charcoal/50"
              }`}
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                k + 1
              )}
              {current && <span aria-hidden className="ripple absolute inset-0 rounded-full border-2 border-ember" />}
            </motion.span>
            <div className="pt-1">
              <p className={`font-display text-2xl leading-tight ${done || current ? "text-charcoal" : "text-charcoal/45"}`}>{s.title}</p>
              {k === 0 && s.sub && (stage >= 0) && (
                <p className="text-sm text-charcoal/70">{data.status === "new" ? s.sub.new : s.sub.accepted}</p>
              )}
              {at && (done || current) && <p className="text-sm tabular-nums text-charcoal/60">{clock(at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Summary({ data }: { data: TrackingData }) {
  const final = data.totalFinal;
  const weighed = data.lines.some((l) => l.unit === "kg" && l.qtyFinal !== null);
  return (
    <section className="mt-10 border-y-2 border-dashed border-charcoal/25 py-5" aria-label="ملخص الطلب">
      <h2 className="font-display text-3xl">طلبك</h2>
      <ul className="mt-2 divide-y divide-charcoal/10">
        {data.lines.map((l, i) => {
          const isFinal = l.unit === "kg" && l.qtyFinal !== null && l.lineFinal !== null;
          return (
            <li key={i} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span>
                  {l.name}
                  <span className="ms-2 text-sm text-charcoal/65">
                    {l.unit === "kg" ? formatKg(l.qtyRequested) : `×${l.qtyRequested}`}
                    {l.variant ? ` · ${l.variant}` : ""}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-baseline gap-2 tabular-nums">
                  {isFinal ? (
                    <>
                      <b className="text-forest">{formatMoney(l.lineFinal!)}</b>
                      <s className="text-sm text-charcoal/50">{formatMoney(l.lineEstimate)}</s>
                    </>
                  ) : (
                    formatMoney(l.lineEstimate)
                  )}
                </span>
              </div>
              {l.extras.length > 0 && <p className="text-sm text-charcoal/65">+ {l.extras.join("، ")}</p>}
              {l.unit === "kg" && (
                <p className="text-sm text-charcoal/65">
                  {isFinal ? (
                    <>الوزن الفعلي بعد التقطيع: <b className="text-forest">{formatKg(l.qtyFinal!)}</b></>
                  ) : (
                    "السعر تقديري لحد ما نوزن"
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <dl className="mt-3 space-y-1">
        {data.discount > 0 && (
          <div className="flex justify-between text-forest">
            <dt>الخصم</dt>
            <dd className="tabular-nums">
              <span dir="ltr">−{formatMoney(data.discount)}</span> {ar.currency}
            </dd>
          </div>
        )}
        {data.fulfillment === "delivery" && (
          <div className="flex justify-between">
            <dt>التوصيل{data.zoneName ? ` (${data.zoneName})` : ""}</dt>
            <dd className="tabular-nums">{data.deliveryFee === 0 ? "مجاني" : `${formatMoney(data.deliveryFee)} ${ar.currency}`}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between pt-1 font-display text-3xl text-forest">
          <dt>{final !== null ? "الإجمالي النهائي" : data.hasButcher ? "الإجمالي التقديري" : "الإجمالي"}</dt>
          <dd className="flex items-baseline gap-1">
            <RollingNumber value={formatMoney(final ?? data.totalEstimate)} />
            <span className="text-base">{ar.currency}</span>
          </dd>
        </div>
        {final !== null && final !== data.totalEstimate && (
          <div className="flex justify-between text-sm text-charcoal/65">
            <dt>كان تقديريًا</dt>
            <dd className="tabular-nums line-through">{formatMoney(data.totalEstimate)} {ar.currency}</dd>
          </div>
        )}
      </dl>
      {data.hasButcher && final === null && !weighed && data.status !== "cancelled" && (
        <p className="mt-2 text-sm text-charcoal/70">{ar.butcher.estimateNote}</p>
      )}
      {final !== null && <p className="mt-2 text-sm text-charcoal/70">ده السعر بعد الوزن. الدفع كاش عند الاستلام.</p>}
    </section>
  );
}

export function TrackingView({ code, whatsapp, phone }: { code: string; whatsapp: string; phone: string }) {
  const [data, setData] = useState<TrackingData | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState("");
  const lastStatus = useRef<OrderStatus | null>(null);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopped = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${code}`, { cache: "no-store" });
      if (res.status === 404) {
        setProblem("notfound");
        stopped.current = true;
        return;
      }
      if (res.status === 429) {
        setProblem("limited");
        failures.current += 3;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next: TrackingData = await res.json();
      failures.current = 0;
      setProblem(null);
      setData(next);
      if (lastStatus.current && lastStatus.current !== next.status) {
        navigator.vibrate?.([20, 40, 20]);
        setAnnounce(headline(next.status, next.fulfillment, next.etaMinutes).big);
      }
      lastStatus.current = next.status;
      if (isTerminal(next.status)) stopped.current = true;
    } catch {
      failures.current += 1;
      setProblem((p) => p ?? "network");
    }
  }, [code]);

  // Poll every few seconds while the tab is visible; back off after errors; stop when the order is finished.
  useEffect(() => {
    stopped.current = false;
    let alive = true;
    const loop = async () => {
      if (!alive || stopped.current) return;
      if (!document.hidden) await load();
      if (!alive || stopped.current) return;
      const delay = Math.min(POLL_MS * 2 ** Math.min(failures.current, 3), 40_000);
      timer.current = setTimeout(loop, delay);
    };
    const onVisible = () => {
      if (!document.hidden && !stopped.current) {
        clearTimeout(timer.current);
        loop();
      }
    };
    loop();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [load]);

  if (problem === "notfound") {
    return (
      <div className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="font-display text-4xl text-forest">مش لاقيين الطلب ده</p>
        <p className="mt-2 text-charcoal/75">اتأكد من الكود ({code}) وجرب تاني. الكود 6 حروف وأرقام.</p>
        <Link href="/menu" className="mt-6 inline-grid h-12 place-items-center rounded-full bg-ember px-7 font-display text-xl text-ivory">
          المنيو
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-5 py-10" aria-busy="true">
        <div className="mx-auto size-60 animate-pulse rounded-full bg-forest/15" />
        <p className="mt-6 text-center text-charcoal/70">
          {problem === "network" ? "مفيش اتصال بالإنترنت. هنحاول تاني لوحدنا." : problem === "limited" ? "طلبات كتير. هنحاول تاني كمان شوية." : "بنجيب طلبك…"}
        </p>
      </div>
    );
  }

  const cancelled = data.status === "cancelled";
  const h = headline(data.status, data.fulfillment, data.etaMinutes);
  const waText = encodeURIComponent(
    `أهلاً كباش، بخصوص طلبي رقم ${data.code}:\n` +
      data.lines.map((l) => `- ${l.name} ${l.unit === "kg" ? formatKg(l.qtyFinal ?? l.qtyRequested) : `×${l.qtyRequested}`}`).join("\n") +
      `\nالإجمالي: ${formatMoney(data.totalFinal ?? data.totalEstimate)} ${ar.currency}`,
  );

  return (
    <div className="mx-auto max-w-xl px-5 pb-10 pt-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-charcoal/70">كود طلبك</p>
          <h1 className="font-display text-5xl leading-none tracking-[0.18em] text-ember" dir="ltr">
            {data.code}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(data.code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          className="h-11 rounded-full border-2 border-forest px-5 text-forest"
        >
          {copied ? "اتنسخ" : "انسخ الكود"}
        </button>
      </div>

      <div className="mt-8">
        <Scene scene={sceneFor(data.status, data.fulfillment)} label={h.big} />
        <div className="mt-5 text-center" aria-live="polite">
          <p data-testid="headline" data-status={data.status} className={`font-display text-4xl ${cancelled ? "text-charcoal" : "text-forest"}`}>
            {h.big}
          </p>
          {!cancelled && <p className="mt-1 text-charcoal/75">{h.small}</p>}
        </div>
      </div>

      {cancelled ? (
        <div role="status" className="mt-6 rounded-2xl border-2 border-charcoal/30 p-5">
          <p className="font-display text-2xl">ليه اتلغى؟</p>
          <p className="mt-1">{data.cancelReason || "المطعم لغى الطلب. اتصل بينا لو محتاج تفاصيل."}</p>
          <p className="mt-3 text-sm text-charcoal/70">مفيش أي مبلغ عليك. تقدر تطلب تاني في أي وقت.</p>
          <Link href="/menu" className="mt-4 inline-grid h-12 place-items-center rounded-full bg-ember px-6 font-display text-xl text-ivory">
            اطلب تاني
          </Link>
        </div>
      ) : (
        <Timeline data={data} />
      )}

      <Summary data={data} />

      <div className="mt-6 flex flex-wrap gap-3">
        {/^\d+$/.test(whatsapp) && (
          <a href={`https://wa.me/${whatsapp}?text=${waText}`} className="grid h-12 place-items-center rounded-full bg-forest px-6 text-ivory">
            كلمنا على واتساب
          </a>
        )}
        {/^\d+$/.test(phone) && (
          <a href={`tel:${phone}`} className="grid h-12 place-items-center rounded-full border-2 border-forest px-6 text-forest">
            اتصل بينا
          </a>
        )}
        <Link href="/menu" className="grid h-12 place-items-center px-3 text-forest underline underline-offset-4">
          اطلب حاجة تانية
        </Link>
      </div>

      {problem === "network" && (
        <p role="status" className="mt-4 text-sm text-ember">
          مفيش اتصال بالإنترنت. اللي قدامك آخر حالة وصلتنا، وهنحدثها أول ما الشبكة ترجع.
        </p>
      )}
      <span className="sr-only" aria-live="assertive">
        {announce}
      </span>
    </div>
  );
}

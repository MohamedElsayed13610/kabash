"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, animate } from "motion/react";
import { useCart, type Flight } from "../cart/CartProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { RollingNumber } from "../ui/RollingNumber";
import { ar } from "@/messages/ar";
import { formatKg, formatMoney } from "@/lib/format";
import { lineTotal } from "@/lib/pricing/unit";

/** A small ember dot that travels from the tapped button into the cart bar. */
function FlyingDot({ flight }: { flight: Flight }) {
  const { cartTarget, endFlight } = useCart();

  useEffect(() => {
    const dot = document.getElementById(`fly-${flight.id}`);
    const target = cartTarget.current?.getBoundingClientRect();
    if (!dot || !target) {
      endFlight(flight.id);
      return;
    }
    const dx = target.left + target.width / 2 - flight.from.x;
    const dy = target.top + target.height / 2 - flight.from.y;
    const controls = animate(
      dot,
      { transform: [`translate(0px, 0px) scale(1)`, `translate(${dx}px, ${dy}px) scale(0.35)`], opacity: [1, 0.9] },
      { duration: 0.6, ease: [0.5, 0, 0.75, 0.4] },
    );
    controls.then(() => endFlight(flight.id));
    return () => controls.stop();
  }, [flight, cartTarget, endFlight]);

  return (
    <div
      id={`fly-${flight.id}`}
      aria-hidden
      className="pointer-events-none fixed z-[60] size-6 rounded-full bg-ember ring-4 ring-saffron/60"
      style={{ left: flight.from.x - 12, top: flight.from.y - 12 }}
    />
  );
}

function CartSheet() {
  const { lines, subtotal, setQty, remove, sheetOpen, setSheetOpen } = useCart();
  const hasButcher = lines.some((l) => l.unit === "kg");

  return (
    <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="الصينية">
      <div className="px-5 pb-4">
        <h2 className="font-display text-3xl text-forest">الصينية بتاعتك</h2>
        {lines.length === 0 ? (
          <p className="py-10 text-center text-charcoal/70">الصينية فاضية. اختار من المنيو وانت تملاها.</p>
        ) : (
          <ul className="mt-3 divide-y divide-charcoal/10">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl leading-tight">{l.name}</p>
                  {(l.variantName || l.extraNames.length > 0) && (
                    <p className="text-sm text-charcoal/65">
                      {[l.variantName, ...l.extraNames].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 font-display text-lg text-ember">
                    {formatMoney(lineTotal(l.unitPrice, l.qty))} {ar.currency}
                    {l.unit === "kg" && <span className="ms-1 font-body text-xs text-charcoal/60">تقديري</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setQty(l.key, l.qty - l.step < l.min - 1e-9 ? 0 : l.qty - l.step)}
                    className="grid size-11 place-items-center rounded-full border border-charcoal/20 text-xl"
                    aria-label={l.qty - l.step < l.min - 1e-9 ? `إزالة ${l.name}` : `تقليل ${l.name}`}
                  >
                    {l.qty - l.step < l.min - 1e-9 ? "×" : "−"}
                  </button>
                  <span className="min-w-12 text-center font-medium tabular-nums">
                    {l.unit === "kg" ? formatKg(l.qty) : l.qty}
                  </span>
                  <button
                    onClick={() => setQty(l.key, l.qty + l.step)}
                    className="grid size-11 place-items-center rounded-full bg-forest text-xl text-ivory"
                    aria-label={`زيادة ${l.name}`}
                  >
                    +
                  </button>
                </div>
                <button onClick={() => remove(l.key)} className="sr-only">
                  إزالة {l.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 0 && (
          <div className="mt-2 border-t-2 border-dashed border-charcoal/20 pt-4">
            <div className="flex items-baseline justify-between">
              <span>إجمالي الأصناف</span>
              <span className="font-display text-3xl text-forest">
                {formatMoney(subtotal)} {ar.currency}
              </span>
            </div>
            <p className="mt-1 text-sm text-charcoal/65">
              {hasButcher ? ar.butcher.estimateNote : "رسوم التوصيل بتتحسب في الخطوة الجاية."}
            </p>
            <Link
              href="/checkout"
              onClick={() => setSheetOpen(false)}
              className="mt-4 grid h-14 place-items-center rounded-full bg-ember font-display text-2xl text-ivory"
            >
              كمّل الطلب
            </Link>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

export function CartBar() {
  const { lines, count, subtotal, bump, flights, cartTarget, setSheetOpen, hydrated } = useCart();
  const path = usePathname();
  const show = hydrated && count > 0 && path !== "/checkout";

  return (
    <>
      {flights.map((f) => (
        <FlyingDot key={f.id} flight={f} />
      ))}
      <AnimatePresence>
        {show && (
          <motion.div
            className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-xl px-3"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
          >
            <button
              ref={cartTarget as React.RefObject<HTMLButtonElement>}
              onClick={() => setSheetOpen(true)}
              className="flex h-14 w-full items-center justify-between rounded-full bg-ember ps-2 pe-6 text-ivory shadow-lg shadow-forest-deep/30"
              aria-label={`افتح الصينية، ${count} صنف`}
            >
              <span className="flex items-center gap-3">
                <motion.span
                  key={bump}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 400 }}
                  className="grid size-10 place-items-center rounded-full bg-ivory font-display text-xl text-ember"
                >
                  {count}
                </motion.span>
                <span className="font-display text-xl">{ar.nav.cart}</span>
              </span>
              <RollingNumber value={formatMoney(subtotal)} className="font-display text-2xl" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <CartSheet />
      <span className="sr-only" aria-live="polite">
        {lines.length > 0 ? `في الصينية ${count} صنف` : ""}
      </span>
    </>
  );
}

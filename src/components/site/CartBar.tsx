"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AnimatePresence, animate } from "motion/react";
import * as m from "motion/react-m";
import { useCart, type Flight } from "../cart/CartProvider";
import { RollingNumber } from "../ui/RollingNumber";
import { ar } from "@/messages/ar";
import { formatMoney } from "@/lib/format";

const CartSheet = dynamic(() => import("./CartSheet").then((m) => m.CartSheet), { ssr: false });

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

export function CartBar() {
  const { lines, count, subtotal, bump, flights, cartTarget, sheetOpen, setSheetOpen, hydrated } = useCart();
  const path = usePathname();
  const show = hydrated && count > 0 && path !== "/checkout";
  const [opened, setOpened] = useState(false); // load the sheet code on first open, keep it for the exit animation
  useEffect(() => {
    if (sheetOpen) setOpened(true);
  }, [sheetOpen]);

  return (
    <>
      {flights.map((f) => (
        <FlyingDot key={f.id} flight={f} />
      ))}
      <AnimatePresence>
        {show && (
          <m.div
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
                <m.span
                  key={bump}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 10, stiffness: 400 }}
                  className="grid size-10 place-items-center rounded-full bg-ivory font-display text-xl text-ember"
                >
                  {count}
                </m.span>
                <span className="font-display text-xl">{ar.nav.cart}</span>
              </span>
              <RollingNumber value={formatMoney(subtotal)} className="font-display text-2xl" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
      {(sheetOpen || opened) && <CartSheet />}
      <span className="sr-only" aria-live="polite">
        {lines.length > 0 ? `في الصينية ${count} صنف` : ""}
      </span>
    </>
  );
}

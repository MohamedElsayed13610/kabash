"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useOrderStatus } from "./OrderStatusProvider";
import { useCart } from "../cart/CartProvider";
import { statusLabel } from "@/lib/tracking-labels";

const SHOWN_ON = ["/menu", "/butcher", "/offers"];
const onChipPage = (path: string) => path === "/" || SHOWN_ON.some((p) => path.startsWith(p));

/** Floating "طلبك قيد التحضير · تتبع" chip on the menu pages while an order is still in progress. */
export function ActiveOrderChip() {
  const path = usePathname();
  const { active } = useOrderStatus();
  const { count, hydrated } = useCart();
  const [dismissed, setDismissed] = useState<string | null>(null); // "CODE:status" the customer closed
  const [sectionInView, setSectionInView] = useState(false);

  // On the home page the full "تتبع طلبك" section is there too: hide the chip while that section is on screen.
  useEffect(() => {
    if (path !== "/") return setSectionInView(false);
    const el = document.querySelector("[data-testid=track-section]");
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setSectionInView(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [path, active.length]);

  const latest = [...active].sort((a, b) => b.at - a.at)[0];
  const key = latest ? `${latest.code}:${latest.status}` : null;
  const show = !!latest && onChipPage(path) && !sectionInView && dismissed !== key;
  // sit above the cart bar when it is on screen
  const bottom = hydrated && count > 0 ? "calc(8.75rem + env(safe-area-inset-bottom))" : "calc(5.25rem + env(safe-area-inset-bottom))";

  return (
    <AnimatePresence>
      {show && latest && (
        <motion.div
          key="chip"
          data-testid="active-order-chip"
          className="fixed inset-x-0 z-30 mx-auto flex max-w-xl justify-center px-3"
          style={{ bottom }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", damping: 24, stiffness: 300 }}
        >
          <div className="flex items-center gap-1 rounded-full bg-forest-deep py-1 ps-1 pe-1 text-ivory shadow-lg shadow-forest-deep/30 ring-1 ring-leaf/40">
            <Link href={`/order/${latest.code}`} className="flex min-h-11 items-center gap-2 rounded-full ps-3 pe-2" aria-label={`${statusLabel(latest.status, latest.fulfillment)}، تتبع الطلب ${latest.code}`}>
              <span aria-hidden className="relative grid size-3 place-items-center">
                <span className="ripple absolute inset-0 rounded-full border-2 border-saffron" />
                <span className="size-2 rounded-full bg-saffron" />
              </span>
              <motion.span key={latest.status} initial={{ scale: 1.08 }} animate={{ scale: 1 }} className="font-medium">
                {statusLabel(latest.status, latest.fulfillment)}
                {active.length > 1 ? ` (+${active.length - 1})` : ""}
              </motion.span>
              <span className="rounded-full bg-saffron px-3 py-1 text-sm font-bold text-charcoal">تتبع</span>
            </Link>
            <button onClick={() => setDismissed(key)} aria-label="إخفاء" className="grid size-11 place-items-center rounded-full text-ivory/70">
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

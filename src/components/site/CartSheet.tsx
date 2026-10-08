"use client";

import Link from "next/link";
import { useCart } from "../cart/CartProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { ar } from "@/messages/ar";
import { formatKg, formatMoney } from "@/lib/format";
import { lineTotal } from "@/lib/pricing/unit";

/** Loaded only the first time the cart is opened, so it is not part of the first page load. */
export function CartSheet() {
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
                    <p className="text-sm text-charcoal/70">
                      {[l.variantName, ...l.extraNames].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="mt-0.5 font-display text-lg text-ember">
                    {formatMoney(lineTotal(l.unitPrice, l.qty))} {ar.currency}
                    {l.unit === "kg" && <span className="ms-1 font-body text-xs text-charcoal/70">تقديري</span>}
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
            <p className="mt-1 text-sm text-charcoal/70">
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


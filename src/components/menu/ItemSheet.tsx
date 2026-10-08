"use client";

import { useRef, useState } from "react";
import type { Item } from "@/lib/types";
import { useCart } from "../cart/CartProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { ItemArt } from "../ui/ItemArt";
import { RollingNumber } from "../ui/RollingNumber";
import { WeightScale } from "./WeightScale";
import { Stamp } from "../ui/Stamp";
import { ar } from "@/messages/ar";
import { formatMoney } from "@/lib/format";
import { lineTotal, unitPrice } from "@/lib/pricing/unit";

const MAX_KG = 10;
const MAX_PIECES = 20;

function SheetBody({ item, artIndex, onDone }: { item: Item; artIndex: number; onDone: () => void }) {
  const { add } = useCart();
  const isKg = item.unit === "kg";
  const [variantId, setVariantId] = useState<string | null>(item.item_variants[0]?.id ?? null);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [qty, setQty] = useState(item.min_qty);
  const button = useRef<HTMLButtonElement>(null);

  const variant = item.item_variants.find((v) => v.id === variantId) ?? null;
  const extras = item.item_extras.filter((e) => extraIds.includes(e.id));
  const unit = unitPrice(item, variant, extras);
  const total = lineTotal(unit, qty);

  const submit = () => {
    add(
      {
        itemId: item.id,
        name: item.name_ar,
        unit: item.unit,
        qty,
        step: item.step_qty,
        min: item.min_qty,
        unitPrice: unit,
        variantId,
        variantName: variant?.name_ar ?? null,
        extraIds,
        extraNames: extras.map((e) => e.name_ar),
      },
      button.current?.getBoundingClientRect(),
    );
    onDone();
  };

  return (
    <div>
      <ItemArt name={item.name_ar} src={item.image_url} index={artIndex} sizes="576px" className="h-44 w-full" />
      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-4xl leading-tight text-forest">{item.name_ar}</h2>
          {isKg && <Stamp label={ar.butcher.fresh} />}
        </div>
        {item.description_ar && <p className="mt-1 text-charcoal/80">{item.description_ar}</p>}
        {item.serving_tag && (
          <p className="mt-2 inline-block rounded-full border border-forest/40 px-3 py-0.5 text-sm text-forest">
            {item.serving_tag}
          </p>
        )}
        {item.is_sample && <p className="mt-2 text-xs text-charcoal/70">صنف تجريبي، السعر مؤقت.</p>}

        {item.item_variants.length > 0 && (
          <fieldset className="mt-5">
            <legend className="mb-2 font-display text-xl">الحجم</legend>
            <div className="flex flex-wrap gap-2">
              {item.item_variants.map((v) => (
                <label key={v.id} className="cursor-pointer">
                  <input
                    type="radio"
                    name="variant"
                    checked={variantId === v.id}
                    onChange={() => setVariantId(v.id)}
                    className="peer sr-only"
                  />
                  <span className="flex min-h-12 flex-col justify-center rounded-2xl border-2 border-charcoal/15 px-4 py-1 peer-checked:border-forest peer-checked:bg-forest peer-checked:text-ivory peer-focus-visible:outline-3 peer-focus-visible:outline-saffron">
                    <span className="font-medium">{v.name_ar}</span>
                    <span className="text-xs opacity-75">{formatMoney(item.base_price + v.price_delta)} {ar.currency}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {item.item_extras.length > 0 && (
          <fieldset className="mt-5">
            <legend className="mb-2 font-display text-xl">إضافات</legend>
            <div className="flex flex-wrap gap-2">
              {item.item_extras.map((e) => (
                <label key={e.id} className="cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraIds.includes(e.id)}
                    onChange={() =>
                      setExtraIds((cur) => (cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id]))
                    }
                    className="peer sr-only"
                  />
                  <span className="flex min-h-11 items-center gap-2 rounded-full border-2 border-charcoal/15 px-4 peer-checked:border-ember peer-checked:bg-ember peer-checked:text-ivory peer-focus-visible:outline-3 peer-focus-visible:outline-saffron">
                    {e.name_ar}
                    <span className="text-xs opacity-75">+{formatMoney(e.price)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-6">
          {isKg ? (
            <>
              <WeightScale value={qty} min={item.min_qty} step={item.step_qty} max={MAX_KG} onChange={setQty} />
              <p className="mt-3 text-center text-sm text-charcoal/70">
                {formatMoney(unit)} {ar.currency} للكيلو. {ar.butcher.estimateNote}
              </p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-display text-xl">الكمية</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(item.min_qty, q - item.step_qty))}
                  disabled={qty <= item.min_qty}
                  aria-label="تقليل الكمية"
                  className="grid size-12 place-items-center rounded-full border-2 border-forest text-2xl text-forest transition active:scale-90 disabled:opacity-30"
                >
                  −
                </button>
                <RollingNumber value={String(qty)} className="font-display text-4xl" />
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(MAX_PIECES, q + item.step_qty))}
                  aria-label="زيادة الكمية"
                  className="grid size-12 place-items-center rounded-full bg-forest text-2xl text-ivory transition active:scale-90"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-5 bg-ivory px-5 pt-2 pb-2">
        <button
          ref={button}
          onClick={submit}
          disabled={!item.available}
          className="flex h-14 w-full items-center justify-between rounded-full bg-ember px-6 text-ivory transition active:scale-[0.98] disabled:bg-charcoal/30"
        >
          <span className="font-display text-xl">{item.available ? "ضيف للصينية" : "خلصت النهارده"}</span>
          {item.available && (
            <span className="flex items-baseline gap-1">
              <RollingNumber value={formatMoney(total)} className="font-display text-2xl" />
              <span className="text-sm">{ar.currency}</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export function ItemSheet({
  item,
  artIndex,
  open,
  onClose,
}: {
  item: Item | null;
  artIndex: number;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label={item?.name_ar ?? "تفاصيل الصنف"}>
      {item && <SheetBody key={item.id} item={item} artIndex={artIndex} onDone={onClose} />}
    </BottomSheet>
  );
}

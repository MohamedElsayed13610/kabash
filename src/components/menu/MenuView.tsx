"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as m from "motion/react-m";
import type { Category, Item, Offer } from "@/lib/types";
import { useCart } from "../cart/CartProvider";
import { ItemArt } from "../ui/ItemArt";
import { Stamp } from "../ui/Stamp";
import dynamic from "next/dynamic";
import { ar } from "@/messages/ar";
import { formatMoney, price } from "@/lib/format";
import { startingPrice, unitPrice } from "@/lib/pricing/unit";

type Kind = "restaurant" | "butcher";

// The item sheet (and the weight scale inside it) is fetched the first time someone opens an item.
const ItemSheet = dynamic(() => import("./ItemSheet").then((x) => x.ItemSheet), { ssr: false });

function offerBadge(o: Offer) {
  return o.discount_type === "percent" ? `خصم ${o.discount_value}%` : `خصم ${formatMoney(o.discount_value)} ${ar.currency}`;
}

function badgeFor(item: Item, offers: Offer[]): string | null {
  const o = offers.find(
    (x) => (x.target_type === "item" && x.target_id === item.id) || (x.target_type === "category" && x.target_id === item.category_id),
  );
  return o ? offerBadge(o) : null;
}

function CategoryNav({ categories, active, onPick }: { categories: Category[]; active: string; onPick: (id: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);

  // Keep the active chip in view horizontally without moving the page.
  useEffect(() => {
    const box = scroller.current;
    const chip = box?.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!box || !chip) return;
    const target = chip.offsetLeft - (box.clientWidth - chip.clientWidth) / 2;
    box.scrollTo({ left: target, behavior: "smooth" });
  }, [active]);

  return (
    <nav aria-label="أقسام المنيو" className="sticky top-0 z-20 border-b border-forest/15 bg-ivory/95">
      <div ref={scroller} className="no-scrollbar mx-auto flex max-w-xl gap-1 overflow-x-auto px-3 py-2">
        {categories.map((c) => {
          const on = c.id === active;
          return (
            <button
              key={c.id}
              data-chip={c.id}
              onClick={() => onPick(c.id)}
              aria-current={on ? "true" : undefined}
              className={`relative h-11 shrink-0 rounded-full px-5 font-medium transition-colors ${on ? "text-ivory" : "text-forest"}`}
            >
              {on && (
                <m.span
                  layoutId="chip-indicator"
                  className="absolute inset-0 rounded-full bg-forest"
                  transition={{ type: "spring", damping: 28, stiffness: 380 }}
                />
              )}
              <span className="relative">{c.name_ar}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function QuickAdd({ item, onDone }: { item: Item; onDone: (rect: DOMRect) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDone(e.currentTarget.getBoundingClientRect());
      }}
      aria-label={`ضيف ${item.name_ar} للصينية`}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-ember text-2xl text-ivory transition active:scale-90"
    >
      +
    </button>
  );
}

function RestaurantRow({
  item,
  index,
  badge,
  onOpen,
  onQuickAdd,
}: {
  item: Item;
  index: number;
  badge: string | null;
  onOpen: () => void;
  onQuickAdd: (rect: DOMRect) => void;
}) {
  const hasOptions = item.item_variants.length > 0;
  const from = item.item_variants.length > 0;
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        className="flex cursor-pointer items-center gap-4 py-4"
      >
        <ItemArt
          name={item.name_ar}
          src={item.image_url}
          index={index}
          sizes="112px"
          className={`size-28 shrink-0 rounded-full ${index % 2 ? "-me-2" : "-ms-2"} ${!item.available ? "grayscale" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2">
            <h3 className="font-display text-2xl leading-tight text-charcoal">{item.name_ar}</h3>
            {badge && <span className="rounded bg-saffron px-2 text-sm font-bold text-charcoal">{badge}</span>}
          </div>
          {item.description_ar && <p className="line-clamp-2 text-sm text-charcoal/70">{item.description_ar}</p>}
          {item.serving_tag && <p className="mt-1 text-sm font-medium text-forest">{item.serving_tag}</p>}
          <p className="mt-1 font-display text-2xl text-ember">
            {from && <span className="me-1 font-body text-sm text-charcoal/60">من</span>}
            {price(startingPrice(item))}
            {item.is_sample && <span className="ms-2 font-body text-xs text-charcoal/45">سعر تجريبي</span>}
          </p>
        </div>
        {item.available ? (
          hasOptions ? (
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ember text-2xl text-ember" aria-hidden>
              +
            </span>
          ) : (
            <QuickAdd item={item} onDone={onQuickAdd} />
          )
        ) : (
          <span className="shrink-0 text-sm font-bold text-charcoal/60">خلصت</span>
        )}
      </div>
    </li>
  );
}

function ButcherTile({ item, index, badge, onOpen }: { item: Item; index: number; badge: string | null; onOpen: () => void }) {
  return (
    <li className={index % 2 ? "mt-8" : ""}>
      <button onClick={onOpen} className="block w-full text-start">
        <div className="relative">
          <ItemArt
            name={item.name_ar}
            src={item.image_url}
            index={index + 1}
            sizes="50vw"
            className={`aspect-[4/5] w-full rounded-t-[999px] rounded-b-2xl ${!item.available ? "grayscale" : ""}`}
          />
          {badge && (
            <span className="absolute start-2 top-2 rounded bg-saffron px-2 text-sm font-bold text-charcoal">{badge}</span>
          )}
        </div>
        <div className="mt-2">
          <Stamp label={ar.butcher.fresh} className="scale-90" />
          <p className="mt-1 font-display text-2xl leading-none text-ember">
            {formatMoney(item.base_price)}
            <span className="ms-1 font-body text-xs text-charcoal/65">{ar.currency} / كجم</span>
          </p>
          <p className="text-xs text-charcoal/60">
            {item.available ? `من ${item.min_qty} كجم` : "خلصت النهارده"}
          </p>
        </div>
      </button>
    </li>
  );
}

export function MenuView({ categories, kind, offers }: { categories: Category[]; kind: Kind; offers: Offer[] }) {
  const { add } = useCart();
  const [active, setActive] = useState(categories[0]?.id ?? "");
  const [selected, setSelected] = useState<{ item: Item; index: number } | null>(null);
  const [open, setOpen] = useState(false);
  const sections = useRef<Map<string, HTMLElement>>(new Map());
  const locked = useRef(false);

  // Scroll-spy: the section crossing the middle band of the viewport wins.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (locked.current) return;
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.getAttribute("data-cat") ?? "");
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    sections.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [categories]);

  const pick = useCallback((id: string) => {
    setActive(id);
    locked.current = true;
    sections.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => (locked.current = false), 700);
  }, []);

  const openItem = (item: Item, index: number) => {
    setSelected({ item, index });
    setOpen(true);
  };

  const quickAdd = (item: Item, rect: DOMRect) =>
    add(
      {
        itemId: item.id,
        name: item.name_ar,
        unit: item.unit,
        qty: item.min_qty,
        step: item.step_qty,
        min: item.min_qty,
        unitPrice: unitPrice(item),
        variantId: null,
        variantName: null,
        extraIds: [],
        extraNames: [],
      },
      rect,
    );

  return (
    <>
      <CategoryNav categories={categories} active={active} onPick={pick} />
      <div className="mx-auto max-w-xl px-4">
        {categories.map((c) => (
          <section
            key={c.id}
            data-cat={c.id}
            ref={(el) => {
              if (el) sections.current.set(c.id, el);
              else sections.current.delete(c.id);
            }}
            className="scroll-mt-14 pt-8"
            aria-labelledby={`cat-${c.id}`}
          >
            <h2 id={`cat-${c.id}`} className="font-display text-4xl text-forest">
              {c.name_ar}
            </h2>
            <div className="sadu mt-1 h-2 text-leaf" aria-hidden />
            {kind === "restaurant" ? (
              <ul className="divide-y divide-charcoal/10 overflow-x-clip">
                {c.items.map((item, i) => (
                  <RestaurantRow
                    key={item.id}
                    item={item}
                    index={i}
                    badge={badgeFor(item, offers)}
                    onOpen={() => openItem(item, i)}
                    onQuickAdd={(rect) => quickAdd(item, rect)}
                  />
                ))}
              </ul>
            ) : (
              <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6">
                {c.items.map((item, i) => (
                  <ButcherTile key={item.id} item={item} index={i} badge={badgeFor(item, offers)} onOpen={() => openItem(item, i)} />
                ))}
              </ul>
            )}
          </section>
        ))}
        <div className="h-28" />
      </div>
      {selected && <ItemSheet item={selected.item} artIndex={selected.index} open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

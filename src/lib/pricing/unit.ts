import type { Extra, Item, Variant } from "../types";

/** Price of ONE unit (one piece, or one kg) with the chosen variant and extras. */
export function unitPrice(item: Pick<Item, "base_price">, variant?: Variant | null, extras: Extra[] = []): number {
  const cents =
    Math.round(item.base_price * 100) +
    Math.round((variant?.price_delta ?? 0) * 100) +
    extras.reduce((sum, e) => sum + Math.round(e.price * 100), 0);
  return cents / 100;
}

/** Lowest price a customer can pay for an item (used for "من X ج.م"). */
export function startingPrice(item: Item): number {
  const deltas = item.item_variants.map((v) => v.price_delta);
  return item.base_price + (deltas.length ? Math.min(0, ...deltas) : 0);
}

export function lineTotal(unit: number, qty: number): number {
  return Math.round(unit * qty * 100) / 100;
}

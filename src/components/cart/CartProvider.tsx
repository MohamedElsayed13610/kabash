"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ItemUnit } from "@/lib/types";
import { lineTotal } from "@/lib/pricing/unit";

export interface CartLine {
  key: string;
  itemId: string;
  name: string;
  unit: ItemUnit;
  qty: number;
  step: number;
  min: number;
  /** Display only. The server recalculates every price from the database. */
  unitPrice: number;
  variantId: string | null;
  variantName: string | null;
  extraIds: string[];
  extraNames: string[];
}

export interface Flight {
  id: number;
  from: { x: number; y: number };
}

interface CartApi {
  lines: CartLine[];
  count: number;
  subtotal: number;
  hydrated: boolean;
  bump: number;
  flights: Flight[];
  endFlight: (id: number) => void;
  cartTarget: React.RefObject<HTMLElement | null>;
  add: (line: Omit<CartLine, "key">, from?: DOMRect | null) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  sheetOpen: boolean;
  setSheetOpen: (v: boolean) => void;
}

const STORAGE_KEY = "kabash.cart.v1";
const Ctx = createContext<CartApi | null>(null);

export const lineKey = (itemId: string, variantId: string | null, extraIds: string[]) =>
  [itemId, variantId ?? "", [...extraIds].sort().join(",")].join("|");

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [bump, setBump] = useState(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const cartTarget = useRef<HTMLElement | null>(null);
  const flightId = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* private mode or corrupted data: start empty */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage full or blocked */
    }
  }, [lines, hydrated]);

  const add = useCallback<CartApi["add"]>((line, from) => {
    const key = lineKey(line.itemId, line.variantId, line.extraIds);
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: round3(l.qty + line.qty), unitPrice: line.unitPrice } : l));
      }
      return [...prev, { ...line, key }];
    });
    navigator.vibrate?.(15);
    if (from) {
      const id = ++flightId.current;
      setFlights((f) => [...f, { id, from: { x: from.left + from.width / 2, y: from.top + from.height / 2 } }]);
    } else {
      setBump((b) => b + 1);
    }
  }, []);

  const endFlight = useCallback((id: number) => {
    setFlights((f) => f.filter((x) => x.id !== id));
    setBump((b) => b + 1);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => prev.flatMap((l) => (l.key !== key ? [l] : qty <= 0 ? [] : [{ ...l, qty: round3(qty) }])));
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);
  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartApi>(
    () => ({
      lines,
      count: lines.length,
      subtotal: Math.round(lines.reduce((s, l) => s + lineTotal(l.unitPrice, l.qty) * 100, 0)) / 100,
      hydrated,
      bump,
      flights,
      endFlight,
      cartTarget,
      add,
      setQty,
      remove,
      clear,
      sheetOpen,
      setSheetOpen,
    }),
    [lines, hydrated, bump, flights, endFlight, add, setQty, remove, clear, sheetOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

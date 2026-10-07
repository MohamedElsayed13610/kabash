"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  readRecentOrders,
  RECENT_EVENT,
  removeRecentOrders,
  updateRecentStatuses,
  type RecentOrder,
} from "@/lib/recent-orders";
import { isTerminal, type OrderStatus } from "@/lib/tracking-types";

const POLL_MS = 10_000;

interface Ctx {
  orders: RecentOrder[];
  /** Orders that are not delivered or cancelled yet (status known). */
  active: (RecentOrder & { status: OrderStatus })[];
  ready: boolean;
  refresh: () => void;
}

const Ctx = createContext<Ctx>({ orders: [], active: [], ready: false, refresh: () => {} });
export const useOrderStatus = () => useContext(Ctx);

/**
 * Keeps the status of this device's recent orders fresh, for every part of the site that wants it.
 * One batched request per poll; finished orders are never polled again; unknown codes are dropped.
 */
export function OrderStatusProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [ready, setReady] = useState(false);
  const failures = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef(false);

  const reload = useCallback(() => setOrders(readRecentOrders()), []);

  const poll = useCallback(async () => {
    if (inflight.current || document.hidden) return;
    // finished orders are final; everything else (including never-checked ones) gets asked about
    const codes = readRecentOrders()
      .filter((o) => !o.status || !isTerminal(o.status))
      .slice(0, 5)
      .map((o) => o.code);
    if (codes.length === 0) return;
    inflight.current = true;
    try {
      const res = await fetch(`/api/track-status?codes=${codes.join(",")}`, { cache: "no-store" });
      if (res.status === 429) {
        failures.current += 3;
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const json: { orders: { code: string; status: OrderStatus; fulfillment: "delivery" | "pickup" }[]; missing: string[] } = await res.json();
      failures.current = 0;
      updateRecentStatuses(Object.fromEntries(json.orders.map((o) => [o.code, { status: o.status, fulfillment: o.fulfillment }])));
      removeRecentOrders(json.missing); // deleted or never existed: stop asking
    } catch {
      failures.current += 1;
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    reload();
    setReady(true);
    let alive = true;
    const loop = async () => {
      await poll();
      if (!alive) return;
      const anyActive = readRecentOrders().some((o) => !o.status || !isTerminal(o.status));
      if (anyActive) timer.current = setTimeout(loop, Math.min(POLL_MS * 2 ** Math.min(failures.current, 3), 60_000));
    };
    void loop();

    const onChange = () => {
      reload();
      // A brand-new order (no status known yet) is asked about right away. Our own status writes don't re-trigger a poll.
      if (readRecentOrders().some((o) => !o.status)) {
        clearTimeout(timer.current);
        void loop();
      }
    };
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer.current);
        void loop();
      }
    };
    window.addEventListener(RECENT_EVENT, onChange);
    window.addEventListener("storage", onChange); // another tab on this phone
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer.current);
      window.removeEventListener(RECENT_EVENT, onChange);
      window.removeEventListener("storage", onChange);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [poll, reload]);

  const value = useMemo<Ctx>(
    () => ({
      orders,
      ready,
      active: orders.filter((o): o is RecentOrder & { status: OrderStatus } => !!o.status && !isTerminal(o.status)),
      refresh: () => void poll(),
    }),
    [orders, ready, poll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

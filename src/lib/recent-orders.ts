import type { OrderStatus } from "./tracking-types";

/**
 * The customer's recent order codes, kept ONLY on their own device so they can reopen tracking.
 * Privacy: we store the code, time, total and last known status. Never a phone number or an address.
 */
export interface RecentOrder {
  code: string;
  at: number; // ms
  total: number;
  status?: OrderStatus;
  fulfillment?: "delivery" | "pickup";
}

const KEY = "kabash.recentOrders.v1";
export const RECENT_EVENT = "kabash:recent";
const MAX = 8;
const MAX_AGE_MS = 14 * 24 * 3600_000;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const STATUSES = ["new", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"];

export function readRecentOrders(): RecentOrder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw
      .filter((r): r is RecentOrder => r && CODE.test(r.code) && typeof r.at === "number" && now - r.at < MAX_AGE_MS)
      .map((r) => ({
        code: r.code,
        at: r.at,
        total: Number(r.total) || 0,
        ...(STATUSES.includes(r.status as string) ? { status: r.status } : {}),
        ...(r.fulfillment === "delivery" || r.fulfillment === "pickup" ? { fulfillment: r.fulfillment } : {}),
      }))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(list: RecentOrder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* storage blocked: tracking by link still works */
  }
}

export function addRecentOrder(code: string, total: number, extra: Partial<Pick<RecentOrder, "status" | "fulfillment">> = {}) {
  if (!CODE.test(code)) return;
  const all = readRecentOrders();
  const existing = all.find((r) => r.code === code);
  write([{ ...existing, code, at: existing?.at ?? Date.now(), total, ...extra }, ...all.filter((r) => r.code !== code)]);
}

/** Records what the server last told us, without moving the order or changing its time. */
export function updateRecentStatuses(updates: Record<string, { status: OrderStatus; fulfillment: "delivery" | "pickup" }>) {
  const all = readRecentOrders();
  let changed = false;
  const next = all.map((r) => {
    const u = updates[r.code];
    if (u && (r.status !== u.status || r.fulfillment !== u.fulfillment)) {
      changed = true;
      return { ...r, ...u };
    }
    return r;
  });
  if (changed) write(next);
}

export function removeRecentOrders(codes: string[]) {
  const set = new Set(codes);
  const all = readRecentOrders();
  if (all.some((r) => set.has(r.code))) write(all.filter((r) => !set.has(r.code)));
}

export const removeRecentOrder = (code: string) => removeRecentOrders([code]);

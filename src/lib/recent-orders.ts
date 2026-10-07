/** Recent order codes, kept only on the customer's own device so they can reopen tracking. */
export interface RecentOrder {
  code: string;
  at: number; // ms
  total: number;
}

const KEY = "kabash.recentOrders.v1";
const MAX = 8;
const MAX_AGE_MS = 14 * 24 * 3600_000;
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;

export function readRecentOrders(): RecentOrder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    const now = Date.now();
    return raw
      .filter((r): r is RecentOrder => r && CODE.test(r.code) && typeof r.at === "number" && now - r.at < MAX_AGE_MS)
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function addRecentOrder(code: string, total: number) {
  if (!CODE.test(code)) return;
  try {
    const rest = readRecentOrders().filter((r) => r.code !== code);
    const existing = readRecentOrders().find((r) => r.code === code);
    localStorage.setItem(KEY, JSON.stringify([{ code, at: existing?.at ?? Date.now(), total }, ...rest].slice(0, MAX)));
  } catch {
    /* storage blocked: tracking by link still works */
  }
}

export function removeRecentOrder(code: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readRecentOrders().filter((r) => r.code !== code)));
  } catch {
    /* ignore */
  }
}

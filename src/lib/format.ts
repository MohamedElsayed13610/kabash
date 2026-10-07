import { ar } from "@/messages/ar";

/** Western digits, no trailing zeros: 250 -> "250", 12.5 -> "12.5". */
export function formatMoney(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const price = (v: number) => `${formatMoney(v)} ${ar.currency}`;

/** 0.5 -> "0.5 كجم", 2 -> "2 كجم" */
export function formatKg(v: number): string {
  return `${Math.round(v * 1000) / 1000} كجم`;
}

/** "13:00" -> "1:00 م" */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "م" : "ص";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

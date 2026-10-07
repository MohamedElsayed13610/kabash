import type { DaySchedule, SiteSettings } from "./types";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Weekday (0 = Sunday) and minutes since midnight in the restaurant's timezone. */
function localClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const spansMidnight = (d: DaySchedule) => toMin(d.close) <= toMin(d.open);

export interface OpenState {
  open: boolean;
  /** Human hint: closing time while open, next opening while closed. "HH:mm" or null. */
  closesAt: string | null;
  opensAt: string | null;
  overridden: boolean;
}

export function getOpenState(settings: Pick<SiteSettings, "opening_hours" | "open_override">, now = new Date()): OpenState {
  const { opening_hours: oh, open_override: override } = settings;
  const { day, minutes } = localClock(now, oh.timezone);
  const today = oh.days.find((d) => d.day === day);
  const yesterday = oh.days.find((d) => d.day === (day + 6) % 7);

  let open = false;
  let closesAt: string | null = null;

  if (today && !today.closed) {
    const o = toMin(today.open);
    const c = toMin(today.close);
    if (spansMidnight(today) ? minutes >= o : minutes >= o && minutes < c) {
      open = true;
      closesAt = today.close;
    }
  }
  // Still inside last night's shift that ran past midnight.
  if (!open && yesterday && !yesterday.closed && spansMidnight(yesterday) && minutes < toMin(yesterday.close)) {
    open = true;
    closesAt = yesterday.close;
  }

  // Next opening today (later) or on one of the next days.
  let opensAt: string | null = null;
  if (!open) {
    for (let i = 0; i < 7; i++) {
      const d = oh.days.find((x) => x.day === (day + i) % 7);
      if (!d || d.closed) continue;
      if (i > 0 || toMin(d.open) > minutes) {
        opensAt = d.open;
        break;
      }
    }
  }

  if (override === "open") return { open: true, closesAt: null, opensAt: null, overridden: true };
  if (override === "closed") return { open: false, closesAt: null, opensAt: null, overridden: true };
  return { open, closesAt, opensAt, overridden: false };
}

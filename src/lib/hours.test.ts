import { describe, expect, it } from "vitest";
import { getOpenState } from "./hours";
import type { DaySchedule } from "./types";

const days: DaySchedule[] = Array.from({ length: 7 }, (_, day) => ({ day, open: "12:00", close: "01:00", closed: false }));
const s = { opening_hours: { timezone: "Africa/Cairo", days }, open_override: "auto" as const };
// Cairo is UTC+3 in October 2026? DST ends the last Friday of October, so +3 on 2026-10-07.
const at = (utc: string) => getOpenState(s, new Date(utc));

describe("getOpenState", () => {
  it("is open in the afternoon", () => expect(at("2026-10-07T12:00:00Z").open).toBe(true));
  it("is open past midnight in the previous day's shift", () => expect(at("2026-10-07T21:30:00Z").open).toBe(true)); // 00:30 Cairo
  it("is closed in the morning and reports the next opening", () => {
    const r = at("2026-10-07T05:00:00Z"); // 08:00 Cairo
    expect(r.open).toBe(false);
    expect(r.opensAt).toBe("12:00");
  });
  it("respects the manual override", () => {
    expect(getOpenState({ ...s, open_override: "closed" }, new Date("2026-10-07T12:00:00Z")).open).toBe(false);
    expect(getOpenState({ ...s, open_override: "open" }, new Date("2026-10-07T05:00:00Z")).open).toBe(true);
  });
});

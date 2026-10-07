import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => ({}) }));

import { weekStart } from "./reports";
import { cairoDayStart } from "./summary";

describe("weekStart (Egypt's week starts on Saturday)", () => {
  it("maps every day to its Saturday", () => {
    // 2026-10-03 is a Saturday
    expect(weekStart("2026-10-03")).toBe("2026-10-03");
    expect(weekStart("2026-10-04")).toBe("2026-10-03"); // Sunday
    expect(weekStart("2026-10-07")).toBe("2026-10-03"); // Wednesday
    expect(weekStart("2026-10-09")).toBe("2026-10-03"); // Friday
    expect(weekStart("2026-10-10")).toBe("2026-10-10"); // next Saturday
  });
});

describe("cairoDayStart", () => {
  it("is midnight in Cairo, including around the daylight-saving switch", () => {
    // October 2026: Cairo is UTC+3 (summer time) before the last Friday of the month
    expect(cairoDayStart(new Date("2026-10-07T12:00:00Z")).toISOString()).toBe("2026-10-06T21:00:00.000Z");
    // 00:30 Cairo is still "today" (the day that began at 21:00Z the evening before)
    expect(cairoDayStart(new Date("2026-10-07T21:30:00Z")).toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });
  it("uses UTC+2 in winter", () => {
    expect(cairoDayStart(new Date("2026-12-15T12:00:00Z")).toISOString()).toBe("2026-12-14T22:00:00.000Z");
  });
});

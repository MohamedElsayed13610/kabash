import { describe, expect, it } from "vitest";
import { cairoLocalToIso, isoToCairoLocal } from "./admin-types";

describe("Cairo local time <-> ISO (offers' start and end dates)", () => {
  it("converts summer time (UTC+3) and winter time (UTC+2) correctly", () => {
    expect(cairoLocalToIso("2026-10-08T14:30")).toBe("2026-10-08T11:30:00.000Z");
    expect(cairoLocalToIso("2026-12-15T14:30")).toBe("2026-12-15T12:30:00.000Z");
  });
  it("round-trips", () => {
    for (const v of ["2026-10-08T00:00", "2026-10-08T23:59", "2026-12-31T12:00", "2027-06-01T09:15"]) {
      expect(isoToCairoLocal(cairoLocalToIso(v))).toBe(v);
    }
  });
  it("handles empty values", () => {
    expect(cairoLocalToIso("")).toBeNull();
    expect(isoToCairoLocal(null)).toBe("");
  });
});

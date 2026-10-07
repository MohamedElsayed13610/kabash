import { describe, expect, it } from "vitest";
import { lineTotal, unitPrice } from "./unit";

describe("unitPrice", () => {
  it("adds variant and extras without float drift", () => {
    const p = unitPrice({ base_price: 250 }, { id: "v", name_ar: "كبير", price_delta: 180, sort: 1 }, [
      { id: "e1", name_ar: "a", price: 15.1, sort: 1 },
      { id: "e2", name_ar: "b", price: 10.2, sort: 2 },
    ]);
    expect(p).toBe(455.3);
  });
  it("prices weight lines per kg", () => {
    expect(lineTotal(420, 1.5)).toBe(630);
    expect(lineTotal(399.99, 0.5)).toBe(200);
  });
});

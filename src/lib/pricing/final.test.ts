import { describe, expect, it } from "vitest";
import { computeFinal, type FinalLine } from "./final";

const mandi: FinalLine = { kind: "restaurant", qtyRequested: 2, qtyFinal: null, unitPrice: 460, lineEstimate: 920, discount: 109.04 };
const meat: FinalLine = { kind: "butcher", qtyRequested: 1.5, qtyFinal: null, unitPrice: 420, lineEstimate: 630, discount: 12.96 };

describe("computeFinal", () => {
  it("has no final total until every butcher line is weighed", () => {
    const r = computeFinal([mandi, meat], 20);
    expect(r.complete).toBe(false);
    expect(r.totalFinal).toBeNull();
  });

  it("prices a weighed line by actual weight and scales its discount", () => {
    const r = computeFinal([mandi, { ...meat, qtyFinal: 1.6 }], 20);
    // meat: 420 x 1.6 = 672 ; discount 12.96 x 1.6/1.5 = 13.824 -> 13.82
    expect(r.lines[1].lineFinal).toBe(672);
    expect(r.lines[1].discountFinal).toBe(13.82);
    // goods: (920 - 109.04) + (672 - 13.82) = 810.96 + 658.18 = 1469.14 ; + 20 delivery
    expect(r.complete).toBe(true);
    expect(r.totalFinal).toBe(1489.14);
    expect(r.discountTotal).toBe(122.86);
  });

  it("lets staff override the line price", () => {
    const r = computeFinal([{ ...meat, qtyFinal: 1.6, lineFinalOverride: 650 }], 0);
    expect(r.lines[0].lineFinal).toBe(650);
    expect(r.totalFinal).toBeCloseTo(650 - 13.82, 2);
  });

  it("a pure-restaurant order is already final", () => {
    const r = computeFinal([mandi], 20);
    expect(r.complete).toBe(true);
    expect(r.totalFinal).toBe(920 - 109.04 + 20);
  });

  it("never lets the discount exceed the line", () => {
    const r = computeFinal([{ ...meat, qtyFinal: 0.5, discount: 9999, lineFinalOverride: 100 }], 0);
    expect(r.totalFinal).toBe(0);
  });
});

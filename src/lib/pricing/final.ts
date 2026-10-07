/**
 * Final price after the butcher weighs the meat. Pure, integer cents.
 *
 * Rules:
 *  - A weighed line costs unit price x actual weight (staff may override the line price).
 *  - Its discount scales with the weight (a percent offer is exactly right; a fixed offer is a close
 *    approximation, which is why staff can override the line price).
 *  - The final total exists only once EVERY butcher line has been weighed; before that the customer
 *    keeps seeing the estimate.
 */

export interface FinalLine {
  kind: "restaurant" | "butcher";
  qtyRequested: number;
  qtyFinal: number | null;
  unitPrice: number;
  lineEstimate: number;
  /** Line offer + share of cart offer, as snapshotted when the order was placed (for the requested qty). */
  discount: number;
  /** Staff override of the gross line price after weighing; otherwise unitPrice x qtyFinal. */
  lineFinalOverride?: number | null;
}

export interface FinalResult {
  complete: boolean;
  lines: { lineFinal: number | null; discountFinal: number }[];
  discountTotal: number;
  totalFinal: number | null;
}

const cents = (v: number) => Math.round(v * 100);

export function computeFinal(lines: FinalLine[], deliveryFee: number): FinalResult {
  let discountC = 0;
  let netC = 0;
  let complete = true;

  const out = lines.map((l) => {
    if (l.kind === "butcher" && l.qtyFinal !== null) {
      const grossC = l.lineFinalOverride != null ? cents(l.lineFinalOverride) : Math.round(cents(l.unitPrice) * l.qtyFinal);
      const dC = Math.min(grossC, Math.round((cents(l.discount) * l.qtyFinal) / l.qtyRequested));
      discountC += dC;
      netC += grossC - dC;
      return { lineFinal: grossC / 100, discountFinal: dC / 100 };
    }
    if (l.kind === "butcher") complete = false;
    discountC += cents(l.discount);
    netC += cents(l.lineEstimate) - cents(l.discount);
    return { lineFinal: null, discountFinal: l.discount };
  });

  return {
    complete,
    lines: out,
    discountTotal: discountC / 100,
    totalFinal: complete ? (netC + cents(deliveryFee)) / 100 : null,
  };
}

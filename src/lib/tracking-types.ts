/** The ONLY order data a customer can see. Everything here is safe to expose by tracking code. */
export type OrderStatus = "new" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

export interface TrackingLine {
  name: string;
  unit: "piece" | "kg";
  qtyRequested: number;
  qtyFinal: number | null;
  lineEstimate: number;
  lineFinal: number | null;
  variant: string | null;
  extras: string[];
}

export interface TrackingData {
  code: string;
  status: OrderStatus;
  fulfillment: "delivery" | "pickup";
  zoneName: string | null;
  etaMinutes: number | null;
  cancelReason: string | null;
  hasButcher: boolean;
  createdAt: string;
  updatedAt: string;
  events: { status: OrderStatus; at: string }[];
  lines: TrackingLine[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  totalEstimate: number;
  totalFinal: number | null;
}

export const STAGES = ["received", "preparing", "on_the_way", "delivered"] as const;

/** 0..3 along the timeline, or -1 when cancelled. */
export function stageOf(status: OrderStatus): number {
  switch (status) {
    case "new":
    case "accepted":
      return 0;
    case "preparing":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
      return 3;
    case "cancelled":
      return -1;
  }
}

export const isTerminal = (s: OrderStatus) => s === "delivered" || s === "cancelled";

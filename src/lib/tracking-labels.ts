import type { OrderStatus } from "./tracking-types";

type Fulfillment = "delivery" | "pickup";

/** Short, friendly status text used in chips and lists. */
export function statusLabel(status: OrderStatus, fulfillment: Fulfillment = "delivery"): string {
  switch (status) {
    case "new":
      return "وصلنا طلبك";
    case "accepted":
      return "طلبك اتأكد";
    case "preparing":
      return "طلبك قيد التحضير";
    case "out_for_delivery":
      return fulfillment === "pickup" ? "طلبك جاهز للاستلام" : "طلبك في الطريق";
    case "delivered":
      return "اتسلم";
    case "cancelled":
      return "اتلغى";
  }
}

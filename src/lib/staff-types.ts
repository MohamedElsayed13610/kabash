import type { OrderStatus } from "./tracking-types";

export interface BoardItem {
  id: string;
  order_id: string;
  kind: "restaurant" | "butcher";
  name_snapshot: string;
  unit: "piece" | "kg";
  qty_requested: number;
  qty_final: number | null;
  unit_price_snapshot: number;
  variant_snapshot: {
    variant?: { name?: string } | null;
    extras?: { name?: string }[];
    discount?: number;
    offers?: string[];
  } | null;
  line_total_estimate: number;
  line_total_final: number | null;
}

export interface BoardOrder {
  id: string;
  code: string;
  customer_name: string;
  phone: string;
  fulfillment: "delivery" | "pickup";
  zone_name: string | null;
  address_json: { street?: string; building?: string; landmark?: string } | null;
  notes: string | null;
  payment_method: "cash";
  has_butcher: boolean;
  has_restaurant: boolean;
  subtotal_estimate: number;
  delivery_fee: number;
  discount_total: number;
  total_estimate: number;
  total_final: number | null;
  status: OrderStatus;
  cancel_reason: string | null;
  acknowledged_at: string | null;
  created_at: string;
  updated_at: string;
  order_items: BoardItem[];
}

export const ORDER_SELECT = "*, order_items(*)";

/** Active orders plus anything from the last 24h, so the "done" tabs are useful without loading history. */
export const boardFilter = (sinceIso: string) => `status.not.in.(delivered,cancelled),created_at.gte.${sinceIso}`;

export const waLink = (phone: string, text?: string) =>
  `https://wa.me/20${phone.replace(/^0/, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

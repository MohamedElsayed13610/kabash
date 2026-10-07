import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import type { TrackingData, TrackingLine } from "@/lib/tracking-types";

export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const num = (v: unknown) => Number(v);

export interface TrackingStatus {
  code: string;
  status: TrackingData["status"];
  fulfillment: "delivery" | "pickup";
  updatedAt: string;
}

/** Just the status of several orders (for the home page list and the floating chip). Same whitelist rules. */
export async function getStatuses(codes: string[]): Promise<TrackingStatus[]> {
  if (codes.length === 0) return [];
  const { data } = await createSupabaseAdmin().from("orders").select("code, status, fulfillment, updated_at").in("code", codes);
  return (data ?? []).map((o) => ({ code: o.code, status: o.status, fulfillment: o.fulfillment, updatedAt: o.updated_at }));
}

/**
 * Looks an order up by its tracking code and returns an explicit whitelist of fields.
 * Never add phone, name, address, notes, internal ids or staff ids here.
 */
export async function getTracking(code: string): Promise<TrackingData | null> {
  const db = createSupabaseAdmin();
  const { data: o } = await db
    .from("orders")
    .select(
      "id, code, status, fulfillment, zone_id, zone_name, cancel_reason, has_butcher, subtotal_estimate, delivery_fee, discount_total, total_estimate, total_final, created_at, updated_at",
    )
    .eq("code", code)
    .maybeSingle();
  if (!o) return null;

  const [items, events, zone] = await Promise.all([
    db
      .from("order_items")
      .select("name_snapshot, unit, qty_requested, qty_final, line_total_estimate, line_total_final, variant_snapshot")
      .eq("order_id", o.id),
    db.from("order_events").select("status, created_at").eq("order_id", o.id).order("created_at"),
    o.zone_id ? db.from("delivery_zones").select("eta_minutes").eq("id", o.zone_id).maybeSingle() : null,
  ]);

  const lines: TrackingLine[] = (items.data ?? []).map((i) => {
    const snap = (i.variant_snapshot ?? {}) as { variant?: { name?: string } | null; extras?: { name?: string }[] };
    return {
      name: i.name_snapshot,
      unit: i.unit,
      qtyRequested: num(i.qty_requested),
      qtyFinal: i.qty_final === null ? null : num(i.qty_final),
      lineEstimate: num(i.line_total_estimate),
      lineFinal: i.line_total_final === null ? null : num(i.line_total_final),
      variant: snap.variant?.name ?? null,
      extras: (snap.extras ?? []).map((e) => e.name ?? "").filter(Boolean),
    };
  });

  return {
    code: o.code,
    status: o.status,
    fulfillment: o.fulfillment,
    zoneName: o.zone_name,
    etaMinutes: zone?.data?.eta_minutes ?? null,
    cancelReason: o.cancel_reason,
    hasButcher: o.has_butcher,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    events: (events.data ?? []).map((e) => ({ status: e.status, at: e.created_at })),
    lines,
    subtotal: num(o.subtotal_estimate),
    discount: num(o.discount_total),
    deliveryFee: num(o.delivery_fee),
    totalEstimate: num(o.total_estimate),
    totalFinal: o.total_final === null ? null : num(o.total_final),
  };
}

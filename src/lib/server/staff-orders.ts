import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { computeFinal, type FinalLine } from "@/lib/pricing/final";
import { ApiError } from "./order-service";
import type { Staff } from "./staff";

export const FLOW = ["new", "accepted", "preparing", "out_for_delivery", "delivered"] as const;
export type Status = (typeof FLOW)[number] | "cancelled";

const admin = () => createSupabaseAdmin();
const num = (v: unknown) => Number(v);

async function loadOrder(id: string) {
  const { data } = await admin()
    .from("orders")
    .select("id, code, status, delivery_fee, acknowledged_at")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new ApiError(404, "not_found", "الطلب مش موجود.");
  return data;
}

export async function changeStatus(staff: Staff, orderId: string, target: Status, reason?: string) {
  const order = await loadOrder(orderId);
  const current = order.status as Status;

  if (current === "delivered" || current === "cancelled") {
    throw new ApiError(409, "finished", "الطلب ده خلص ومينفعش يتغير.");
  }
  if (target === "cancelled") {
    if (!reason || reason.trim().length < 2) throw new ApiError(400, "reason_required", "اكتب سبب الإلغاء.");
  } else {
    if (FLOW.indexOf(target) <= FLOW.indexOf(current as (typeof FLOW)[number])) {
      throw new ApiError(409, "bad_transition", "مينفعش ترجع الطلب خطوة لورا.");
    }
    if (target === "out_for_delivery" || target === "delivered") {
      const { data: lines } = await admin()
        .from("order_items")
        .select("name_snapshot, kind, qty_final")
        .eq("order_id", orderId);
      const pending = (lines ?? []).filter((l) => l.kind === "butcher" && l.qty_final === null);
      if (pending.length > 0) {
        throw new ApiError(409, "needs_weighing", `وزّن الأول: ${pending.map((l) => l.name_snapshot).join("، ")}`);
      }
    }
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: target };
  if (!order.acknowledged_at) Object.assign(patch, { acknowledged_at: now, acknowledged_by: staff.userId });
  if (target === "cancelled") patch.cancel_reason = reason!.trim();

  // The .eq("status", current) makes a double-tap or two staff phones race-safe: only one wins.
  const { data: updated, error } = await admin().from("orders").update(patch).eq("id", orderId).eq("status", current).select("id");
  if (error) throw new ApiError(500, "db_error", "مقدرناش نغير الحالة. جرب تاني.");
  if (!updated?.length) throw new ApiError(409, "conflict", "حد تاني غير الطلب ده الآن. حدّث الصفحة.");

  await admin().from("order_events").insert({
    order_id: orderId,
    status: target,
    by_user: staff.userId,
    note: target === "cancelled" ? reason!.trim() : null,
  });
  return { code: order.code, status: target };
}

/** Stops the alarm without changing the status. */
export async function acknowledge(staff: Staff, orderId: string) {
  await loadOrder(orderId);
  await admin()
    .from("orders")
    .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: staff.userId })
    .eq("id", orderId)
    .is("acknowledged_at", null);
}

export interface WeighInput {
  id: string; // order_items.id
  qtyFinal: number;
  lineFinal?: number | null;
}

export async function weigh(staff: Staff, orderId: string, inputs: WeighInput[]) {
  const order = await loadOrder(orderId);
  if (order.status === "delivered" || order.status === "cancelled") {
    throw new ApiError(409, "finished", "الطلب ده خلص ومينفعش يتغير.");
  }
  const db = admin();
  const { data: rows, error } = await db
    .from("order_items")
    .select("id, kind, qty_requested, qty_final, unit_price_snapshot, line_total_estimate, line_total_final, variant_snapshot")
    .eq("order_id", orderId);
  if (error || !rows) throw new ApiError(500, "db_error", "حصلت مشكلة. جرب تاني.");

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const i of inputs) {
    const r = byId.get(i.id);
    if (!r) throw new ApiError(404, "line_not_found", "الصنف مش في الطلب ده.");
    if (r.kind !== "butcher") throw new ApiError(400, "not_butcher", "الوزن للجزارة بس.");
  }

  const merged = rows.map((r) => {
    const w = inputs.find((i) => i.id === r.id);
    const snap = (r.variant_snapshot ?? {}) as { discount?: number };
    return {
      row: r,
      input: w,
      line: {
        kind: r.kind,
        qtyRequested: num(r.qty_requested),
        qtyFinal: w ? w.qtyFinal : r.qty_final === null ? null : num(r.qty_final),
        unitPrice: num(r.unit_price_snapshot),
        lineEstimate: num(r.line_total_estimate),
        discount: num(snap.discount ?? 0),
        lineFinalOverride: w ? (w.lineFinal ?? null) : r.line_total_final === null ? null : num(r.line_total_final),
      } satisfies FinalLine,
    };
  });

  const res = computeFinal(merged.map((m) => m.line), num(order.delivery_fee));

  for (const [idx, m] of merged.entries()) {
    if (!m.input) continue;
    const { error: e } = await db
      .from("order_items")
      .update({ qty_final: m.input.qtyFinal, line_total_final: res.lines[idx].lineFinal })
      .eq("id", m.row.id);
    if (e) throw new ApiError(500, "db_error", "مقدرناش نسجل الوزن. جرب تاني.");
  }
  const { error: oErr } = await db
    .from("orders")
    .update({ discount_total: res.discountTotal, total_final: res.totalFinal })
    .eq("id", orderId);
  if (oErr) throw new ApiError(500, "db_error", "مقدرناش نسجل الإجمالي. جرب تاني.");

  await db.from("order_events").insert({
    order_id: orderId,
    status: order.status,
    by_user: staff.userId,
    note: res.complete ? "تم وزن الطلب وحساب السعر النهائي" : "تم وزن جزء من الطلب",
  });
  return { complete: res.complete, totalFinal: res.totalFinal };
}

"use client";

import { useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import type { BoardOrder } from "@/lib/staff-types";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

const REASONS = ["العميل طلب الإلغاء", "الصنف خلص", "خارج منطقة التوصيل", "مش بنرد على رقم العميل", "الطلب مكرر"];

export function CancelSheet({
  order,
  onClose,
  onConfirm,
}: {
  order: BoardOrder | null;
  onClose: () => void;
  onConfirm: (o: BoardOrder, reason: string) => void;
}) {
  return (
    <BottomSheet open={!!order} onClose={onClose} label="إلغاء الطلب">
      {order && <CancelBody key={order.id} order={order} onConfirm={onConfirm} onClose={onClose} />}
    </BottomSheet>
  );
}

function CancelBody({ order, onConfirm, onClose }: { order: BoardOrder; onConfirm: (o: BoardOrder, r: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-ember">إلغاء الطلب {order.code}</h2>
      <p className="mt-1 text-charcoal/70">السبب بيظهر للعميل في صفحة المتابعة.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={`min-h-11 rounded-full border-2 px-4 ${reason === r ? "border-ember bg-ember text-ivory" : "border-charcoal/20"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <label htmlFor="cancel-reason" className="mt-4 block font-medium">
        أو اكتب السبب
      </label>
      <textarea
        id="cancel-reason"
        rows={2}
        maxLength={200}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1 w-full rounded-xl border-2 border-charcoal/20 p-3 text-lg outline-none focus:border-forest"
      />
      <div className="mt-4 flex gap-3">
        <button
          disabled={reason.trim().length < 2}
          onClick={() => onConfirm(order, reason.trim())}
          className="h-14 flex-1 rounded-full bg-ember font-display text-2xl text-ivory disabled:opacity-40"
        >
          تأكيد الإلغاء
        </button>
        <button onClick={onClose} className="h-14 rounded-full border-2 border-charcoal/30 px-6">
          رجوع
        </button>
      </div>
    </div>
  );
}

const parse = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", ".").trim());

export function WeighSheet({
  order,
  onClose,
  onSave,
}: {
  order: BoardOrder | null;
  onClose: () => void;
  onSave: (o: BoardOrder, lines: { id: string; qtyFinal: number; lineFinal: number | null }[]) => void;
}) {
  return (
    <BottomSheet open={!!order} onClose={onClose} label="وزن الطلب">
      {order && <WeighBody key={order.id} order={order} onSave={onSave} onClose={onClose} />}
    </BottomSheet>
  );
}

function WeighBody({
  order,
  onSave,
  onClose,
}: {
  order: BoardOrder;
  onSave: (o: BoardOrder, lines: { id: string; qtyFinal: number; lineFinal: number | null }[]) => void;
  onClose: () => void;
}) {
  const lines = order.order_items.filter((i) => i.kind === "butcher");
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(lines.map((l) => [l.id, String(l.qty_final ?? l.qty_requested)])),
  );
  const [price, setPrice] = useState<Record<string, string>>({});

  const rows = lines.map((l) => {
    const q = parse(qty[l.id] ?? "");
    const override = (price[l.id] ?? "").trim() === "" ? null : parse(price[l.id]);
    const ok = Number.isFinite(q) && q >= 0.05 && q <= 50 && (override === null || (Number.isFinite(override) && override >= 0));
    return { l, q, override, ok, computed: Math.round(l.unit_price_snapshot * (Number.isFinite(q) ? q : 0) * 100) / 100 };
  });
  const allOk = rows.every((r) => r.ok);

  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">وزن الطلب {order.code}</h2>
      <p className="mt-1 text-charcoal/70">اكتب الوزن الفعلي بعد التقطيع. السعر بيتحسب لوحده، وتقدر تغيره لو محتاج.</p>
      <ul className="mt-3 space-y-4">
        {rows.map(({ l, ok, computed }) => (
          <li key={l.id} className="rounded-xl bg-charcoal/5 p-3">
            <p className="font-display text-2xl">{l.name_snapshot}</p>
            <p className="text-sm text-charcoal/70">
              المطلوب {formatKg(l.qty_requested)} · {formatMoney(l.unit_price_snapshot)} {ar.currency} للكيلو
            </p>
            <div className="mt-2 flex gap-3">
              <label className="flex-1">
                <span className="text-sm">الوزن (كجم)</span>
                <input
                  inputMode="decimal"
                  value={qty[l.id]}
                  onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })}
                  aria-invalid={!ok}
                  className="mt-1 h-14 w-full rounded-xl border-2 border-charcoal/20 px-3 text-xl outline-none focus:border-forest aria-[invalid=true]:border-ember"
                  dir="ltr"
                />
              </label>
              <label className="flex-1">
                <span className="text-sm">السعر ({formatMoney(computed)} تلقائي)</span>
                <input
                  inputMode="decimal"
                  placeholder={String(computed)}
                  value={price[l.id] ?? ""}
                  onChange={(e) => setPrice({ ...price, [l.id]: e.target.value })}
                  className="mt-1 h-14 w-full rounded-xl border-2 border-charcoal/20 px-3 text-xl outline-none focus:border-forest"
                  dir="ltr"
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex gap-3">
        <button
          disabled={!allOk}
          onClick={() => onSave(order, rows.map((r) => ({ id: r.l.id, qtyFinal: r.q, lineFinal: r.override })))}
          className="h-14 flex-1 rounded-full bg-forest font-display text-2xl text-ivory disabled:opacity-40"
        >
          حفظ الوزن
        </button>
        <button onClick={onClose} className="h-14 rounded-full border-2 border-charcoal/30 px-6">
          رجوع
        </button>
      </div>
    </div>
  );
}

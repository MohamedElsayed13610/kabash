"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin, useFreshSignal } from "./AdminProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { SortableList } from "./SortableList";
import { btn, EmptyState, Field, inputCls, SampleBadge, Switch } from "./ui";
import type { AdminZone } from "@/lib/admin-types";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

interface Form { name_ar: string; fee: string; min_order: string; eta: string; active: boolean; is_sample: boolean }
const toForm = (z: AdminZone | null): Form =>
  z ? { name_ar: z.name_ar, fee: String(z.fee), min_order: String(z.min_order), eta: z.eta_minutes ? String(z.eta_minutes) : "", active: z.active, is_sample: z.is_sample } : { name_ar: "", fee: "", min_order: "0", eta: "", active: true, is_sample: false };

const num = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", ".").trim());

function Editor({ zone, onClose }: { zone: AdminZone | null; onClose: () => void }) {
  const { post, busy } = useAdmin();
  const [f, setF] = useState(toForm(zone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((c) => ({ ...c, [k]: v }));

  async function save() {
    const e: Record<string, string> = {};
    if (f.name_ar.trim().length < 2) e.name_ar = "اكتب اسم المنطقة";
    if (f.fee.trim() === "" || !(num(f.fee) >= 0)) e.fee = "اكتب سعر التوصيل (0 لو مجاني)";
    if (!(num(f.min_order || "0") >= 0)) e.min_order = "رقم صحيح";
    if (f.eta.trim() !== "" && !(Number.isInteger(num(f.eta)) && num(f.eta) > 0)) e.eta = "عدد دقايق صحيح";
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await post(
      "zones",
      { op: "save", id: zone?.id, zone: { name_ar: f.name_ar.trim(), fee: num(f.fee), min_order: num(f.min_order || "0"), eta_minutes: f.eta.trim() === "" ? null : num(f.eta), active: f.active, is_sample: f.is_sample } },
      "اتحفظت المنطقة",
    );
    if (res.ok) onClose();
    else setErrors(Object.fromEntries(Object.entries(res.error?.fields ?? {}).map(([k, v]) => [k.replace(/^zone\./, ""), v])));
  }

  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">{zone ? "تعديل منطقة" : "منطقة جديدة"}</h2>
      <div className="mt-4 space-y-4">
        <Field label="اسم المنطقة" error={errors.name_ar}>
          {(id) => <input id={id} className={inputCls} value={f.name_ar} maxLength={60} onChange={(e) => set("name_ar", e.target.value)} aria-invalid={!!errors.name_ar} autoFocus />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سعر التوصيل (ج.م)" error={errors.fee}>
            {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.fee} onChange={(e) => set("fee", e.target.value)} aria-invalid={!!errors.fee} />}
          </Field>
          <Field label="أقل طلب (ج.م)" error={errors.min_order} hint="0 = من غير حد أدنى">
            {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.min_order} onChange={(e) => set("min_order", e.target.value)} aria-invalid={!!errors.min_order} />}
          </Field>
        </div>
        <Field label="وقت التوصيل المتوقع (دقيقة)" error={errors.eta} hint="اختياري، بيظهر للعميل">
          {(id) => <input id={id} inputMode="numeric" dir="ltr" className={inputCls} value={f.eta} onChange={(e) => set("eta", e.target.value)} aria-invalid={!!errors.eta} />}
        </Field>
        <div className="flex items-center justify-between rounded-xl bg-charcoal/5 px-3 py-3">
          <div>
            <p className="font-medium">المنطقة شغالة</p>
            <p className="text-sm text-charcoal/70">لو اتقفلت بتختفي من صفحة الطلب</p>
          </div>
          <Switch label="المنطقة شغالة" checked={f.active} onChange={(v) => set("active", v)} />
        </div>
        {zone?.is_sample && (
          <div className="flex items-center justify-between rounded-xl bg-saffron/30 px-3 py-3">
            <p className="font-medium">منطقة تجريبية</p>
            <Switch label="منطقة تجريبية" checked={f.is_sample} onChange={(v) => set("is_sample", v)} />
          </div>
        )}
        <p className="text-sm text-charcoal/70">التعديل بيسري على الطلبات الجديدة فورًا. الطلبات اللي اتبعتت قبل كده بتحتفظ بالسعر اللي اتحسبت بيه.</p>
      </div>
      <div className="sticky bottom-0 mt-4 flex gap-3 bg-ivory py-2">
        <button type="button" onClick={save} disabled={busy} className={`${btn.primary} h-14 flex-1 !text-2xl`}>{busy ? "بنحفظ…" : "حفظ"}</button>
        <button type="button" onClick={onClose} className={`${btn.ghost} h-14`}>إلغاء</button>
      </div>
    </div>
  );
}

function FreeDelivery({ threshold }: { threshold: number | null }) {
  const { post, busy } = useAdmin();
  const [on, setOn] = useState(threshold !== null);
  const [val, setVal] = useState(threshold === null ? "" : String(threshold));
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setOn(threshold !== null);
    setVal(threshold === null ? "" : String(threshold));
  }, [threshold]);

  async function save(nextOn: boolean) {
    setErr(null);
    const v = num(val);
    if (nextOn && !(v > 0)) return setErr("اكتب المبلغ");
    await post("settings", { key: "free_delivery_threshold", value: nextOn ? v : null }, nextOn ? "اتحفظ حد التوصيل المجاني" : "اتقفل التوصيل المجاني");
  }

  return (
    <section className="mt-6 rounded-2xl border-2 border-charcoal/10 bg-white p-4" aria-label="التوصيل المجاني">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">توصيل مجاني</h2>
          <p className="text-sm text-charcoal/70">التوصيل ببلاش لو إجمالي الطلب (بعد الخصم) وصل للمبلغ ده.</p>
        </div>
        <Switch label="توصيل مجاني" checked={on} disabled={busy} onChange={(v) => { setOn(v); if (!v) void save(false); }} />
      </div>
      {on && (
        <div className="mt-3 flex items-start gap-2">
          <div className="flex-1">
            <input aria-label="الحد الأدنى للتوصيل المجاني" inputMode="decimal" dir="ltr" placeholder="500" className={inputCls} value={val} onChange={(e) => setVal(e.target.value)} aria-invalid={!!err} />
            {err && <p role="alert" className="mt-1 text-sm font-medium text-ember">{err}</p>}
          </div>
          <button onClick={() => save(true)} disabled={busy} className={btn.primary}>حفظ</button>
        </div>
      )}
    </section>
  );
}

export function ZonesManager({ zones, threshold, renderedAt }: { zones: AdminZone[]; threshold: number | null; renderedAt: number }) {
  const { post, confirm, ready } = useAdmin();
  useFreshSignal(renderedAt);
  const latest = useRef(zones);
  latest.current = zones;
  const openZone = async (id: string | null) => {
    await ready(); // never edit from stale data
    setEditing({ zone: id ? (latest.current.find((z) => z.id === id) ?? null) : null });
  };
  const [editing, setEditing] = useState<{ zone: AdminZone | null } | null>(null);
  const [opt, setOpt] = useState<Record<string, boolean>>({});
  useEffect(() => setOpt({}), [zones]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-forest">مناطق التوصيل</h1>
        <button onClick={() => void openZone(null)} className={btn.ember} data-testid="add-zone">+ منطقة</button>
      </div>
      <p className="mt-1 text-charcoal/70">أنت اللي بتحدد المناطق وأسعارها. اسحب ⠿ للترتيب، وقفل أي منطقة عشان تختفي من الطلب.</p>

      {zones.length === 0 ? (
        <div className="mt-4"><EmptyState title="مفيش مناطق توصيل" body="من غير مناطق العملاء مش هيقدروا يطلبوا توصيل، بس يقدروا يستلموا من المحل." /></div>
      ) : (
        <SortableList
          className="mt-4 space-y-2"
          items={zones}
          onCommit={(ids) => void post("zones", { op: "reorder", ids })}
          render={(z, { handle, up, down }) => {
            const active = opt[z.id] ?? z.active;
            return (
              <div data-zone={z.name_ar} className={`flex items-center gap-1 rounded-2xl border-2 border-charcoal/10 bg-white p-2 ${active ? "" : "opacity-60"}`}>
                {handle}
                <button onClick={() => void openZone(z.id)} className="min-w-0 flex-1 text-start">
                  <span className="block font-display text-xl leading-tight"><span className="sr-only">تعديل </span>{z.name_ar} {z.is_sample && <SampleBadge />}</span>
                  <span className="block text-sm text-charcoal/70">
                    {formatMoney(z.fee)} {ar.currency}
                    {z.min_order > 0 ? ` · أقل طلب ${formatMoney(z.min_order)}` : ""}
                    {z.eta_minutes ? ` · ${z.eta_minutes} دقيقة` : ""}
                  </span>
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  <Switch label={`${z.name_ar} شغالة`} checked={active} onChange={(v) => { setOpt((o) => ({ ...o, [z.id]: v })); void post("zones", { op: "patch", id: z.id, active: v }); }} />
                  <span className="text-xs">{active ? "شغالة" : "موقوفة"}</span>
                </div>
                <div className="hidden sm:flex">{up}{down}</div>
                <button
                  aria-label={`مسح ${z.name_ar}`}
                  onClick={async () => {
                    if (await confirm({ title: `مسح منطقة ${z.name_ar}؟`, body: "الطلبات القديمة هتفضل محتفظة باسم المنطقة وسعرها.", confirmLabel: "امسح", danger: true })) await post("zones", { op: "delete", id: z.id }, "اتمسحت المنطقة");
                  }}
                  className="grid size-11 place-items-center rounded-full text-xl text-ember"
                >
                  ×
                </button>
              </div>
            );
          }}
        />
      )}

      <FreeDelivery threshold={threshold} />

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} label="منطقة التوصيل">
        {editing && <Editor key={editing.zone?.id ?? "new"} zone={editing.zone} onClose={() => setEditing(null)} />}
      </BottomSheet>
    </div>
  );
}

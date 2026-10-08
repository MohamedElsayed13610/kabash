"use client";

import { useEffect, useRef, useState } from "react";
import { useAdmin, useFreshSignal } from "./AdminProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { discardUpload, ImageUploader } from "./ImageUploader";
import { btn, EmptyState, Field, inputCls, SampleBadge, Switch } from "./ui";
import { cairoLocalToIso, isoToCairoLocal, type AdminOffer } from "@/lib/admin-types";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

interface Target { id: string; name: string; group: string }

interface Form {
  title_ar: string;
  description_ar: string;
  image_url: string | null;
  discount_type: "percent" | "fixed";
  discount_value: string;
  target_type: "item" | "category" | "cart";
  target_id: string;
  starts: string;
  ends: string;
  active: boolean;
  is_sample: boolean;
}

const blank: Form = { title_ar: "", description_ar: "", image_url: null, discount_type: "percent", discount_value: "10", target_type: "cart", target_id: "", starts: "", ends: "", active: true, is_sample: false };

const toForm = (o: AdminOffer): Form => ({
  title_ar: o.title_ar,
  description_ar: o.description_ar ?? "",
  image_url: o.image_url,
  discount_type: o.discount_type,
  discount_value: String(o.discount_value),
  target_type: o.target_type,
  target_id: o.target_id ?? "",
  starts: isoToCairoLocal(o.starts_at),
  ends: isoToCairoLocal(o.ends_at),
  active: o.active,
  is_sample: o.is_sample,
});

export function offerStatus(o: AdminOffer, now = Date.now()): { label: string; tone: string } {
  if (!o.active) return { label: "موقوف", tone: "bg-charcoal/15" };
  if (o.starts_at && new Date(o.starts_at).getTime() > now) return { label: "لسه ما بدأش", tone: "bg-saffron text-charcoal" };
  if (o.ends_at && new Date(o.ends_at).getTime() < now) return { label: "خلص", tone: "bg-charcoal/15" };
  return { label: "شغال", tone: "bg-leaf text-forest-deep" };
}

function Editor({ offer, targets, onClose }: { offer: AdminOffer | null; targets: { items: Target[]; categories: Target[] }; onClose: () => void }) {
  const { post, busy } = useAdmin();
  const initial = offer ? toForm(offer) : blank;
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((c) => ({ ...c, [k]: v }));

  async function cancel() {
    if (f.image_url !== initial.image_url) await discardUpload(f.image_url);
    onClose();
  }

  async function save() {
    const e: Record<string, string> = {};
    const value = Number(f.discount_value.replace(",", "."));
    if (f.title_ar.trim().length < 2) e.title_ar = "اكتب عنوان العرض";
    if (!(value > 0)) e.discount_value = "اكتب قيمة الخصم";
    if (f.discount_type === "percent" && value > 100) e.discount_value = "النسبة مينفعش تعدي 100";
    if (f.target_type !== "cart" && !f.target_id) e.target_id = "اختار الصنف أو القسم";
    if (f.starts && f.ends && f.ends <= f.starts) e.ends_at = "تاريخ النهاية لازم يكون بعد البداية";
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;

    const res = await post(
      "offers",
      {
        op: "save",
        id: offer?.id,
        offer: {
          title_ar: f.title_ar.trim(),
          description_ar: f.description_ar.trim() || null,
          image_url: f.image_url,
          discount_type: f.discount_type,
          discount_value: value,
          target_type: f.target_type,
          target_id: f.target_type === "cart" ? null : f.target_id,
          starts_at: cairoLocalToIso(f.starts),
          ends_at: cairoLocalToIso(f.ends),
          active: f.active,
          is_sample: f.is_sample,
        },
      },
      "اتحفظ العرض",
    );
    if (res.ok) onClose();
    else {
      setErrors(Object.fromEntries(Object.entries(res.error?.fields ?? {}).map(([k, v]) => [k.replace(/^offer\./, ""), v])));
      setFormError(res.error?.message ?? null);
    }
  }

  const targetList = f.target_type === "item" ? targets.items : targets.categories;

  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">{offer ? "تعديل عرض" : "عرض جديد"}</h2>
      <div className="mt-4 space-y-4">
        <ImageUploader label="صورة العرض (اختياري)" folder="offers" aspect={16 / 9} outputWidth={1280} value={f.image_url} onChange={(u) => set("image_url", u)} />
        <Field label="عنوان العرض" error={errors.title_ar}>
          {(id) => <input id={id} className={inputCls} value={f.title_ar} maxLength={80} onChange={(e) => set("title_ar", e.target.value)} aria-invalid={!!errors.title_ar} />}
        </Field>
        <Field label="وصف (اختياري)">
          {(id) => <textarea id={id} rows={2} maxLength={300} className={`${inputCls} h-auto py-2`} value={f.description_ar} onChange={(e) => set("description_ar", e.target.value)} />}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع الخصم">
            {(id) => (
              <select id={id} className={inputCls} value={f.discount_type} onChange={(e) => set("discount_type", e.target.value as Form["discount_type"])}>
                <option value="percent">نسبة %</option>
                <option value="fixed">مبلغ ثابت (ج.م)</option>
              </select>
            )}
          </Field>
          <Field label="قيمة الخصم" error={errors.discount_value}>
            {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.discount_value} onChange={(e) => set("discount_value", e.target.value)} aria-invalid={!!errors.discount_value} />}
          </Field>
        </div>

        <Field label="بينطبق على">
          {(id) => (
            <select id={id} className={inputCls} value={f.target_type} onChange={(e) => { set("target_type", e.target.value as Form["target_type"]); set("target_id", ""); }}>
              <option value="cart">إجمالي الطلب كله</option>
              <option value="category">قسم معين</option>
              <option value="item">صنف معين</option>
            </select>
          )}
        </Field>
        {f.target_type !== "cart" && (
          <Field label={f.target_type === "item" ? "الصنف" : "القسم"} error={errors.target_id}>
            {(id) => (
              <select id={id} className={inputCls} value={f.target_id} onChange={(e) => set("target_id", e.target.value)} aria-invalid={!!errors.target_id}>
                <option value="">اختار…</option>
                {targetList.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.group} — {t.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="يبدأ (اختياري، بتوقيت القاهرة)">
            {(id) => <input id={id} type="datetime-local" dir="ltr" className={inputCls} value={f.starts} onChange={(e) => set("starts", e.target.value)} />}
          </Field>
          <Field label="ينتهي (اختياري)" error={errors.ends_at}>
            {(id) => <input id={id} type="datetime-local" dir="ltr" className={inputCls} value={f.ends} onChange={(e) => set("ends", e.target.value)} aria-invalid={!!errors.ends_at} />}
          </Field>
        </div>

        <div className="divide-y divide-charcoal/10 rounded-xl bg-charcoal/5 px-3">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">العرض شغال</p>
              <p className="text-sm text-charcoal/60">بيظهر في الصفحة الرئيسية ويتحسب تلقائيًا في الطلب</p>
            </div>
            <Switch label="العرض شغال" checked={f.active} onChange={(v) => set("active", v)} />
          </div>
          <div className="flex items-center justify-between py-3">
            <p className="font-medium">عرض تجريبي</p>
            <Switch label="عرض تجريبي" checked={f.is_sample} onChange={(v) => set("is_sample", v)} />
          </div>
        </div>
        <p className="text-sm text-charcoal/60">لو أكتر من عرض اتنطبق على نفس الصنف، بيتحسب الأكبر خصمًا بس. وعرض واحد على إجمالي الطلب.</p>
      </div>

      {formError && <p role="alert" className="mt-3 rounded-xl bg-ember/10 p-3 font-medium text-ember">{formError}</p>}
      <div className="sticky bottom-0 mt-4 flex gap-3 bg-ivory py-2">
        <button type="button" onClick={save} disabled={busy} className={`${btn.primary} h-14 flex-1 !text-2xl`}>
          {busy ? "بنحفظ…" : "حفظ العرض"}
        </button>
        <button type="button" onClick={cancel} className={`${btn.ghost} h-14`}>إلغاء</button>
      </div>
    </div>
  );
}

export function OffersManager({ offers, targets, renderedAt }: { offers: AdminOffer[]; targets: { items: Target[]; categories: Target[] }; renderedAt: number }) {
  const { post, confirm, ready } = useAdmin();
  useFreshSignal(renderedAt);
  const latest = useRef(offers);
  latest.current = offers;
  const openOffer = async (id: string | null) => {
    await ready(); // never edit from stale data
    setEditing({ offer: id ? (latest.current.find((o) => o.id === id) ?? null) : null });
  };
  const [editing, setEditing] = useState<{ offer: AdminOffer | null } | null>(null);
  const [now] = useState(() => Date.now());
  const [opt, setOpt] = useState<Record<string, boolean>>({}); // instant switches until the server data arrives
  useEffect(() => setOpt({}), [offers]);
  const nameOf = (o: AdminOffer) =>
    o.target_type === "cart" ? "إجمالي الطلب" : (o.target_type === "item" ? targets.items : targets.categories).find((t) => t.id === o.target_id)?.name ?? "—";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-forest">العروض</h1>
        <button onClick={() => void openOffer(null)} className={btn.ember} data-testid="add-offer">
          + عرض
        </button>
      </div>
      <p className="mt-1 text-charcoal/70">العرض الشغال بيظهر في الصفحة الرئيسية ويتخصم تلقائيًا من الطلب.</p>

      <div className="mt-4 space-y-3">
        {offers.length === 0 && <EmptyState title="مفيش عروض" body="اعمل أول عرض وهيظهر للعملاء فورًا." />}
        {offers.map((o) => {
          const active = opt[o.id] ?? o.active;
          const st = offerStatus({ ...o, active }, now);
          return (
            <article key={o.id} data-offer={o.title_ar} className="rounded-2xl border-2 border-charcoal/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl leading-tight">
                    {o.title_ar} {o.is_sample && <SampleBadge />}
                  </h2>
                  <p className="text-charcoal/70">
                    خصم {o.discount_type === "percent" ? `${o.discount_value}%` : `${formatMoney(o.discount_value)} ${ar.currency}`} على {nameOf(o)}
                  </p>
                  {(o.starts_at || o.ends_at) && (
                    <p className="text-sm text-charcoal/60">
                      {o.starts_at ? `من ${isoToCairoLocal(o.starts_at).replace("T", " ")}` : ""} {o.ends_at ? `لحد ${isoToCairoLocal(o.ends_at).replace("T", " ")}` : ""}
                    </p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${st.tone}`}>{st.label}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <Switch label={`تشغيل ${o.title_ar}`} checked={active} onChange={(v) => { setOpt((m) => ({ ...m, [o.id]: v })); void post("offers", { op: "patch", id: o.id, active: v }); }} />
                  <span className="text-sm">شغال</span>
                </label>
                <button onClick={() => void openOffer(o.id)} className={btn.ghost}>تعديل</button>
                <button
                  onClick={async () => {
                    if (await confirm({ title: `مسح عرض "${o.title_ar}"؟`, confirmLabel: "امسح العرض", danger: true })) await post("offers", { op: "delete", id: o.id }, "اتمسح العرض");
                  }}
                  className="h-12 px-3 text-ember underline"
                >
                  مسح
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} label="العرض">
        {editing && <Editor key={editing.offer?.id ?? "new"} offer={editing.offer} targets={targets} onClose={() => setEditing(null)} />}
      </BottomSheet>
    </div>
  );
}

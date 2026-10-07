"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "./AdminProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { ItemArt } from "../ui/ItemArt";
import { SortableList } from "./SortableList";
import { discardUpload, ImageUploader } from "./ImageUploader";
import { btn, EmptyState, Field, inputCls, SampleBadge, Switch } from "./ui";
import type { AdminCategory, AdminItem } from "@/lib/admin-types";
import { formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

type Kind = "restaurant" | "butcher";

/* ------------------------------------------------------------------ item editor */

interface ItemForm {
  category_id: string;
  name_ar: string;
  description_ar: string;
  unit: "piece" | "kg";
  base_price: string;
  min_qty: string;
  step_qty: string;
  serving_tag: string;
  image_url: string | null;
  available: boolean;
  active: boolean;
  featured: boolean;
  is_sample: boolean;
  variants: { name_ar: string; price_delta: string }[];
  extras: { name_ar: string; price: string }[];
}

const toForm = (i: AdminItem): ItemForm => ({
  category_id: i.category_id,
  name_ar: i.name_ar,
  description_ar: i.description_ar ?? "",
  unit: i.unit,
  base_price: String(i.base_price),
  min_qty: String(i.min_qty),
  step_qty: String(i.step_qty),
  serving_tag: i.serving_tag ?? "",
  image_url: i.image_url,
  available: i.available,
  active: i.active,
  featured: i.featured,
  is_sample: i.is_sample,
  variants: i.item_variants.map((v) => ({ name_ar: v.name_ar, price_delta: String(v.price_delta) })),
  extras: i.item_extras.map((e) => ({ name_ar: e.name_ar, price: String(e.price) })),
});

const blankForm = (cat: AdminCategory): ItemForm => ({
  category_id: cat.id,
  name_ar: "",
  description_ar: "",
  unit: cat.type === "butcher" ? "kg" : "piece",
  base_price: "",
  min_qty: cat.type === "butcher" ? "0.5" : "1",
  step_qty: cat.type === "butcher" ? "0.5" : "1",
  serving_tag: "",
  image_url: null,
  available: true,
  active: true,
  featured: false,
  is_sample: false,
  variants: [],
  extras: [],
});

const n = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(",", ".").trim());

function ItemEditor({
  open,
  item,
  category,
  categories,
  onClose,
}: {
  open: boolean;
  item: AdminItem | null;
  category: AdminCategory | null;
  categories: AdminCategory[];
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label={item ? "تعديل صنف" : "صنف جديد"}>
      {category && <ItemEditorBody key={item?.id ?? "new"} item={item} category={category} categories={categories} onClose={onClose} />}
    </BottomSheet>
  );
}

function ItemEditorBody({ item, category, categories, onClose }: { item: AdminItem | null; category: AdminCategory; categories: AdminCategory[]; onClose: () => void }) {
  const { post, busy } = useAdmin();
  const initial = item ? toForm(item) : blankForm(category);
  const [f, setF] = useState<ItemForm>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const set = <K extends keyof ItemForm>(k: K, v: ItemForm[K]) => setF((cur) => ({ ...cur, [k]: v }));
  const cat = categories.find((c) => c.id === f.category_id) ?? category;
  const isKg = f.unit === "kg";

  async function cancel() {
    if (f.image_url !== initial.image_url) await discardUpload(f.image_url); // an upload that was never saved
    onClose();
  }

  async function save() {
    const e: Record<string, string> = {};
    if (f.name_ar.trim().length < 2) e.name_ar = "اكتب اسم الصنف";
    if (!Number.isFinite(n(f.base_price)) || f.base_price.trim() === "" || n(f.base_price) < 0) e.base_price = "اكتب السعر";
    if (!(n(f.min_qty) > 0)) e.min_qty = "لازم أكبر من صفر";
    if (!(n(f.step_qty) > 0)) e.step_qty = "لازم أكبر من صفر";
    if (!isKg && (!Number.isInteger(n(f.min_qty)) || !Number.isInteger(n(f.step_qty)))) e.min_qty = "بالقطعة: أرقام صحيحة";
    if (f.variants.some((v) => !v.name_ar.trim() || !Number.isFinite(n(v.price_delta || "0")))) e.variants = "كمّل أسماء الأحجام وأسعارها";
    if (f.extras.some((x) => !x.name_ar.trim() || !Number.isFinite(n(x.price || "0")))) e.extras = "كمّل أسماء الإضافات وأسعارها";
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length) return;

    const res = await post(
      "items",
      {
        op: "save",
        id: item?.id,
        item: {
          category_id: f.category_id,
          name_ar: f.name_ar.trim(),
          description_ar: f.description_ar.trim() || null,
          unit: f.unit,
          base_price: n(f.base_price),
          min_qty: n(f.min_qty),
          step_qty: n(f.step_qty),
          serving_tag: f.serving_tag.trim() || null,
          image_url: f.image_url,
          available: f.available,
          active: f.active,
          featured: f.featured,
          is_sample: f.is_sample,
        },
        variants: f.variants.map((v) => ({ name_ar: v.name_ar.trim(), price_delta: n(v.price_delta || "0") })),
        extras: f.extras.map((x) => ({ name_ar: x.name_ar.trim(), price: n(x.price || "0") })),
      },
      "اتحفظ الصنف",
    );
    if (res.ok) onClose();
    else {
      const fl = res.error?.fields ?? {};
      setErrors(Object.fromEntries(Object.entries(fl).map(([k, v]) => [k.replace(/^item\./, ""), v])));
      setFormError(res.error?.message ?? null);
    }
  }

  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">{item ? "تعديل صنف" : `صنف جديد في ${cat.name_ar}`}</h2>

      <div className="mt-4 space-y-4">
        <ImageUploader label="صورة الصنف" folder="items" aspect={1} outputWidth={1000} value={f.image_url} onChange={(u) => set("image_url", u)} />

        <Field label="اسم الصنف" error={errors.name_ar}>
          {(id) => <input id={id} className={inputCls} value={f.name_ar} onChange={(e) => set("name_ar", e.target.value)} aria-invalid={!!errors.name_ar} maxLength={80} />}
        </Field>
        <Field label="الوصف (اختياري)">
          {(id) => <textarea id={id} rows={2} maxLength={400} className={`${inputCls} h-auto py-2`} value={f.description_ar} onChange={(e) => set("description_ar", e.target.value)} />}
        </Field>

        <Field label="القسم">
          {(id) => (
            <select id={id} className={inputCls} value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
              {categories.filter((c) => c.type === category.type).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_ar}
                </option>
              ))}
            </select>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="الوحدة">
            {(id) => (
              <select
                id={id}
                className={inputCls}
                value={f.unit}
                disabled={category.type === "butcher"}
                onChange={(e) => {
                  const unit = e.target.value as "piece" | "kg";
                  setF((cur) => ({ ...cur, unit, min_qty: unit === "kg" ? "0.5" : "1", step_qty: unit === "kg" ? "0.5" : "1" }));
                }}
              >
                <option value="piece">بالقطعة</option>
                <option value="kg">بالكيلو</option>
              </select>
            )}
          </Field>
          <Field label={isKg ? "سعر الكيلو (ج.م)" : "السعر (ج.م)"} error={errors.base_price}>
            {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.base_price} onChange={(e) => set("base_price", e.target.value)} aria-invalid={!!errors.base_price} />}
          </Field>
        </div>

        {isKg && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="أقل وزن (كجم)" error={errors.min_qty}>
              {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.min_qty} onChange={(e) => set("min_qty", e.target.value)} aria-invalid={!!errors.min_qty} />}
            </Field>
            <Field label="الزيادة (كجم)" error={errors.step_qty} hint="مثلًا 0.5 يعني نص كيلو">
              {(id) => <input id={id} inputMode="decimal" dir="ltr" className={inputCls} value={f.step_qty} onChange={(e) => set("step_qty", e.target.value)} aria-invalid={!!errors.step_qty} />}
            </Field>
          </div>
        )}

        {category.type === "restaurant" && (
          <Field label="وصف الحصة (اختياري)" hint="مثال: الصينية تكفي 4 أفراد">
            {(id) => <input id={id} className={inputCls} value={f.serving_tag} onChange={(e) => set("serving_tag", e.target.value)} maxLength={60} />}
          </Field>
        )}

        {/* sizes */}
        <fieldset>
          <legend className="mb-1 font-medium">الأحجام (اختياري)</legend>
          <p className="mb-2 text-sm text-charcoal/60">الفرق بيتضاف على السعر الأساسي. الحجم الأول هو الافتراضي.</p>
          {f.variants.map((v, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input aria-label={`اسم الحجم ${i + 1}`} placeholder="صغير" className={inputCls} value={v.name_ar} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, name_ar: e.target.value } : x)))} />
              <input aria-label={`فرق سعر الحجم ${i + 1}`} placeholder="+0" inputMode="decimal" dir="ltr" className={`${inputCls} !w-28`} value={v.price_delta} onChange={(e) => set("variants", f.variants.map((x, j) => (j === i ? { ...x, price_delta: e.target.value } : x)))} />
              <button type="button" aria-label="شيل الحجم" onClick={() => set("variants", f.variants.filter((_, j) => j !== i))} className="size-12 shrink-0 rounded-full text-xl text-ember">
                ×
              </button>
            </div>
          ))}
          {errors.variants && <p role="alert" className="mb-1 text-sm font-medium text-ember">{errors.variants}</p>}
          <button type="button" onClick={() => set("variants", [...f.variants, { name_ar: "", price_delta: "0" }])} className={btn.ghost}>
            + حجم
          </button>
        </fieldset>

        {/* extras */}
        <fieldset>
          <legend className="mb-1 font-medium">إضافات (اختياري)</legend>
          {f.extras.map((x, i) => (
            <div key={i} className="mb-2 flex gap-2">
              <input aria-label={`اسم الإضافة ${i + 1}`} placeholder="سلطة زبادي" className={inputCls} value={x.name_ar} onChange={(e) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, name_ar: e.target.value } : y)))} />
              <input aria-label={`سعر الإضافة ${i + 1}`} placeholder="15" inputMode="decimal" dir="ltr" className={`${inputCls} !w-28`} value={x.price} onChange={(e) => set("extras", f.extras.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} />
              <button type="button" aria-label="شيل الإضافة" onClick={() => set("extras", f.extras.filter((_, j) => j !== i))} className="size-12 shrink-0 rounded-full text-xl text-ember">
                ×
              </button>
            </div>
          ))}
          {errors.extras && <p role="alert" className="mb-1 text-sm font-medium text-ember">{errors.extras}</p>}
          <button type="button" onClick={() => set("extras", [...f.extras, { name_ar: "", price: "0" }])} className={btn.ghost}>
            + إضافة
          </button>
        </fieldset>

        <div className="divide-y divide-charcoal/10 rounded-xl bg-charcoal/5 px-3">
          {(
            [
              ["available", "متاح دلوقتي", "لو اتقفل بيظهر للعميل \"خلصت\""],
              ["active", "ظاهر في الموقع", "اقفله لو الصنف مش بيتباع"],
              ["featured", "من الأصناف المميزة", "بيظهر في الصفحة الرئيسية"],
              ["is_sample", "صنف تجريبي (السعر مؤقت)", "اقفله بعد ما تراجع الاسم والسعر"],
            ] as const
          ).map(([k, label, hint]) => (
            <div key={k} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-sm text-charcoal/60">{hint}</p>
              </div>
              <Switch label={label} checked={f[k]} onChange={(v) => set(k, v)} />
            </div>
          ))}
        </div>
      </div>

      {formError && <p role="alert" className="mt-3 rounded-xl bg-ember/10 p-3 font-medium text-ember">{formError}</p>}

      <div className="sticky bottom-0 mt-4 flex gap-3 bg-ivory py-2">
        <button type="button" onClick={save} disabled={busy} className={`${btn.primary} h-14 flex-1 !text-2xl`}>
          {busy ? "بنحفظ…" : "حفظ الصنف"}
        </button>
        <button type="button" onClick={cancel} className={`${btn.ghost} h-14`}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ category editor */

function CategoryEditor({ state, onClose }: { state: { kind: Kind; cat: AdminCategory | null } | null; onClose: () => void }) {
  const { post, busy } = useAdmin();
  const [name, setName] = useState("");
  useEffect(() => setName(state?.cat?.name_ar ?? ""), [state]);
  return (
    <BottomSheet open={!!state} onClose={onClose} label={state?.cat ? "تعديل القسم" : "قسم جديد"}>
      {state && (
        <form
          className="px-5 pb-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = state.cat
              ? await post("categories", { op: "update", id: state.cat.id, name_ar: name }, "اتحفظ القسم")
              : await post("categories", { op: "create", type: state.kind, name_ar: name }, "اتضاف القسم");
            if (res.ok) onClose();
          }}
        >
          <h2 className="font-display text-3xl text-forest">{state.cat ? "تعديل القسم" : state.kind === "butcher" ? "قسم جزارة جديد" : "قسم مطعم جديد"}</h2>
          <Field label="اسم القسم" className="mt-4">
            {(id) => <input id={id} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />}
          </Field>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={busy || name.trim().length < 2} className={`${btn.primary} h-14 flex-1 !text-2xl`}>
              حفظ
            </button>
            <button type="button" onClick={onClose} className={`${btn.ghost} h-14`}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ manager */

export function MenuManager({ categories }: { categories: AdminCategory[] }) {
  const { post, confirm } = useAdmin();
  const [kind, setKind] = useState<Kind>("restaurant");
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: AdminItem | null; cat: AdminCategory } | null>(null);
  const [catEdit, setCatEdit] = useState<{ kind: Kind; cat: AdminCategory | null } | null>(null);
  const [opt, setOpt] = useState<Record<string, boolean>>({}); // instant toggles until the server data arrives
  useEffect(() => setOpt({}), [categories]);

  const list = categories.filter((c) => c.type === kind);
  const sampleCount = categories.flatMap((c) => c.items).filter((i) => i.is_sample).length;

  const toggleItem = (id: string, k: "available" | "active", v: boolean) => {
    setOpt((o) => ({ ...o, [`${id}:${k}`]: v }));
    void post("items", { op: "patch", id, [k]: v });
  };

  return (
    <div>
      <h1 className="font-display text-4xl text-forest">المنيو</h1>

      {sampleCount > 0 && (
        <p className="mt-2 rounded-xl bg-saffron/40 p-3">
          فيه <b>{sampleCount}</b> صنف تجريبي (عليهم علامة <SampleBadge />). راجع الأسماء والأسعار وغيّرها، وبعدين اقفل &quot;صنف تجريبي&quot;.
        </p>
      )}

      <div role="tablist" aria-label="نوع المنيو" className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-forest/10 p-1">
        {(["restaurant", "butcher"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setOpen(null);
            }}
            className={`h-12 rounded-full font-display text-xl ${kind === k ? "bg-forest text-ivory" : "text-forest"}`}
          >
            {k === "restaurant" ? "المطعم" : "الجزارة"}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-charcoal/70">اسحب ⠿ عشان ترتب الأقسام والأصناف.</p>
        <button onClick={() => setCatEdit({ kind, cat: null })} className={btn.ghost} data-testid="add-category">
          + قسم
        </button>
      </div>

      {list.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="مفيش أقسام" body="ضيف قسم وبعدين ضيف فيه الأصناف." />
        </div>
      ) : (
        <SortableList
          className="mt-3 space-y-3"
          items={list}
          onCommit={(ids) => void post("categories", { op: "reorder", ids })}
          render={(c, { handle, up, down }) => {
            const expanded = open === c.id;
            return (
              <section className="rounded-2xl border-2 border-charcoal/10 bg-white" data-category={c.name_ar}>
                <div className="flex items-center gap-1 p-2">
                  {handle}
                  <button
                    onClick={() => setOpen(expanded ? null : c.id)}
                    aria-expanded={expanded}
                    className="flex min-h-12 flex-1 items-center justify-between gap-2 text-start"
                  >
                    <span>
                      <span className={`font-display text-2xl ${c.active ? "" : "text-charcoal/40"}`}>{c.name_ar}</span>
                      <span className="ms-2 text-sm text-charcoal/60">{c.items.length} صنف</span>
                      {!c.active && <span className="ms-2 text-sm text-ember">مخفي</span>}
                    </span>
                    <span aria-hidden className={`transition-transform ${expanded ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {up}
                  {down}
                </div>

                {expanded && (
                  <div className="border-t border-charcoal/10 p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <button onClick={() => setEditing({ item: null, cat: c })} className={btn.primary} data-testid="add-item">
                        + صنف جديد
                      </button>
                      <button onClick={() => setCatEdit({ kind, cat: c })} className={btn.ghost}>
                        تعديل الاسم
                      </button>
                      <label className="flex items-center gap-2">
                        <Switch label={`إظهار ${c.name_ar}`} checked={opt[`${c.id}:cat`] ?? c.active} onChange={(v) => { setOpt((o) => ({ ...o, [`${c.id}:cat`]: v })); void post("categories", { op: "update", id: c.id, active: v }); }} />
                        <span className="text-sm">ظاهر</span>
                      </label>
                      <button
                        onClick={async () => {
                          if (await confirm({ title: `مسح قسم ${c.name_ar}؟`, body: `هيتمسح معاه ${c.items.length} صنف. الطلبات القديمة مش هتتأثر.`, confirmLabel: "امسح القسم", danger: true })) {
                            await post("categories", { op: "delete", id: c.id }, "اتمسح القسم");
                          }
                        }}
                        className="h-12 px-3 text-ember underline"
                      >
                        مسح القسم
                      </button>
                    </div>

                    {c.items.length === 0 ? (
                      <p className="py-4 text-center text-charcoal/60">القسم فاضي. ضيف أول صنف.</p>
                    ) : (
                      <SortableList
                        items={c.items}
                        onCommit={(ids) => void post("items", { op: "reorder", ids })}
                        render={(i, ctl) => {
                          const available = opt[`${i.id}:available`] ?? i.available;
                          return (
                            <div data-item={i.name_ar} className={`flex items-center gap-2 rounded-xl border border-charcoal/10 bg-ivory p-2 ${i.active ? "" : "opacity-60"}`}>
                              {ctl.handle}
                              <ItemArt name={i.name_ar} src={i.image_url} sizes="56px" className="size-14 shrink-0 rounded-full" />
                              <button onClick={() => setEditing({ item: i, cat: c })} className="min-w-0 flex-1 text-start" aria-label={`تعديل ${i.name_ar}`}>
                                <span className="block truncate font-display text-xl leading-tight">
                                  {i.name_ar} {i.is_sample && <SampleBadge />}
                                </span>
                                <span className="block text-sm text-charcoal/70">
                                  {formatMoney(i.base_price)} {ar.currency}
                                  {i.unit === "kg" ? " / كجم" : ""}
                                  {!i.active ? " · مخفي" : ""}
                                  {i.featured ? " · مميز" : ""}
                                </span>
                              </button>
                              <div className="flex flex-col items-center gap-0.5">
                                <Switch label={`${i.name_ar} متاح`} checked={available} onChange={(v) => toggleItem(i.id, "available", v)} />
                                <span className="text-xs">{available ? "متاح" : "خلصت"}</span>
                              </div>
                              <div className="hidden sm:flex">{ctl.up}{ctl.down}</div>
                            </div>
                          );
                        }}
                      />
                    )}
                  </div>
                )}
              </section>
            );
          }}
        />
      )}

      <ItemEditor
        open={!!editing}
        item={editing?.item ?? null}
        category={editing?.cat ?? null}
        categories={categories}
        onClose={() => setEditing(null)}
      />
      <CategoryEditor state={catEdit} onClose={() => setCatEdit(null)} />
    </div>
  );
}

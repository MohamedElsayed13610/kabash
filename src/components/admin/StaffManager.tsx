"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";
import { BottomSheet } from "../ui/BottomSheet";
import { btn, EmptyState, Field, inputCls, Switch } from "./ui";

export interface StaffRow {
  user_id: string;
  name: string;
  role: "owner" | "manager" | "cashier";
  active: boolean;
  email: string;
  last_sign_in: string | null;
}

const ROLES = [
  { v: "owner", label: "مالك", hint: "كل حاجة" },
  { v: "manager", label: "مدير", hint: "المنيو والعروض والتوصيل والطلبات" },
  { v: "cashier", label: "كاشير", hint: "الطلبات بس" },
] as const;

function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function PasswordField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label="كلمة السر" error={error} hint="8 حروف على الأقل. هتقولها للموظف بنفسك، وهو يقدر يغيرها بعدين.">
      {(id) => (
        <div className="flex gap-2">
          <input id={id} type={show ? "text" : "password"} autoComplete="new-password" dir="ltr" className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
          <button type="button" onClick={() => setShow((s) => !s)} className="h-12 shrink-0 rounded-full border-2 border-charcoal/20 px-4 text-sm">
            {show ? "إخفاء" : "إظهار"}
          </button>
          <button type="button" onClick={() => { onChange(randomPassword()); setShow(true); }} className="h-12 shrink-0 rounded-full border-2 border-forest px-4 text-sm text-forest">
            اعمل واحدة
          </button>
        </div>
      )}
    </Field>
  );
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const { post, busy } = useAdmin();
  const [f, setF] = useState({ name: "", email: "", role: "cashier" as StaffRow["role"], password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "اكتب الاسم";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "الإيميل مش صحيح";
    if (f.password.length < 8) e.password = "كلمة السر 8 حروف على الأقل";
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await post("staff", { op: "create", name: f.name.trim(), email: f.email.trim(), role: f.role, password: f.password }, "اتضاف الموظف");
    if (res.ok) onClose();
    else setErrors(res.error?.fields ?? {});
  }
  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">موظف جديد</h2>
      <div className="mt-4 space-y-4">
        <Field label="الاسم" error={errors.name}>{(id) => <input id={id} className={inputCls} value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!errors.name} />}</Field>
        <Field label="الإيميل (للدخول)" error={errors.email}>{(id) => <input id={id} type="email" dir="ltr" autoComplete="off" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!errors.email} />}</Field>
        <Field label="الصلاحية">
          {(id) => (
            <select id={id} className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as StaffRow["role"] })}>
              {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label} — {r.hint}</option>)}
            </select>
          )}
        </Field>
        <PasswordField value={f.password} onChange={(v) => setF({ ...f, password: v })} error={errors.password} />
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={save} disabled={busy} className={`${btn.primary} h-14 flex-1 !text-2xl`}>{busy ? "بنضيف…" : "ضيف الموظف"}</button>
        <button onClick={onClose} className={`${btn.ghost} h-14`}>إلغاء</button>
      </div>
    </div>
  );
}

function PasswordSheet({ target, onClose }: { target: StaffRow; onClose: () => void }) {
  const { post, busy } = useAdmin();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string>();
  return (
    <div className="px-5 pb-4">
      <h2 className="font-display text-3xl text-forest">كلمة سر جديدة لـ {target.name}</h2>
      <div className="mt-4"><PasswordField value={pw} onChange={setPw} error={err} /></div>
      <div className="mt-4 flex gap-3">
        <button
          disabled={busy}
          onClick={async () => {
            if (pw.length < 8) return setErr("كلمة السر 8 حروف على الأقل");
            const res = await post("staff", { op: "password", userId: target.user_id, password: pw }, "اتغيرت كلمة السر");
            if (res.ok) onClose();
          }}
          className={`${btn.primary} h-14 flex-1 !text-2xl`}
        >
          غيّر كلمة السر
        </button>
        <button onClick={onClose} className={`${btn.ghost} h-14`}>إلغاء</button>
      </div>
    </div>
  );
}

export function StaffManager({ staff, meId }: { staff: StaffRow[]; meId: string }) {
  const { post, confirm } = useAdmin();
  const [creating, setCreating] = useState(false);
  const [pwFor, setPwFor] = useState<StaffRow | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl text-forest">الموظفين</h1>
        <button onClick={() => setCreating(true)} className={btn.ember} data-testid="add-staff">+ موظف</button>
      </div>
      <p className="mt-1 text-charcoal/70">اللي بتوقفه بيتقفل عليه الدخول والإشعارات فورًا.</p>

      <div className="mt-4 space-y-3">
        {staff.length === 0 && <EmptyState title="مفيش موظفين" body="ضيف أول موظف." />}
        {staff.map((s) => {
          const me = s.user_id === meId;
          return (
            <article key={s.user_id} data-staff={s.email} className={`rounded-2xl border-2 border-charcoal/10 bg-white p-4 ${s.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-2xl leading-tight">{s.name} {me && <span className="rounded bg-forest px-2 py-0.5 align-middle font-body text-xs text-ivory">أنت</span>}</h2>
                  <p className="truncate text-sm text-charcoal/70" dir="ltr">{s.email}</p>
                  <p className="text-xs text-charcoal/50">
                    آخر دخول: {s.last_sign_in ? new Date(s.last_sign_in).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }) : "لسه"}
                  </p>
                </div>
                <label className="flex flex-col items-center gap-0.5">
                  <Switch label={`${s.name} شغال`} checked={s.active} disabled={me} onChange={(v) => void post("staff", { op: "update", userId: s.user_id, active: v }, v ? "اتفعل الحساب" : "اتوقف الحساب")} />
                  <span className="text-xs">{s.active ? "شغال" : "موقوف"}</span>
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  aria-label={`صلاحية ${s.name}`}
                  value={s.role}
                  disabled={me}
                  onChange={(e) => void post("staff", { op: "update", userId: s.user_id, role: e.target.value }, "اتغيرت الصلاحية")}
                  className="h-12 rounded-full border-2 border-charcoal/20 bg-white px-4 disabled:opacity-60"
                >
                  {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
                </select>
                <button onClick={() => setPwFor(s)} className={btn.ghost}>كلمة سر جديدة</button>
                {!me && (
                  <button
                    onClick={async () => {
                      if (await confirm({ title: `مسح حساب ${s.name}؟`, body: "هيتمسح الحساب نهائي. الطلبات القديمة مش هتتأثر.", confirmLabel: "امسح الحساب", danger: true })) await post("staff", { op: "delete", userId: s.user_id }, "اتمسح الحساب");
                    }}
                    className="h-12 px-3 text-ember underline"
                  >
                    مسح
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <BottomSheet open={creating} onClose={() => setCreating(false)} label="موظف جديد">{creating && <CreateSheet onClose={() => setCreating(false)} />}</BottomSheet>
      <BottomSheet open={!!pwFor} onClose={() => setPwFor(null)} label="كلمة سر جديدة">{pwFor && <PasswordSheet key={pwFor.user_id} target={pwFor} onClose={() => setPwFor(null)} />}</BottomSheet>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useAdmin } from "./AdminProvider";
import { btn, Field, inputCls, Switch } from "./ui";
import type { SiteSettings } from "@/lib/types";

const DAYS = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];

const digitsOnly = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[\s\-+().]/g, "");
/** 01012345678 -> 201012345678 (WhatsApp wants the international format without +). */
const toWhatsapp = (s: string) => {
  const d = digitsOnly(s);
  if (/^01\d{9}$/.test(d)) return `20${d.slice(1)}`;
  return d;
};

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-2xl border-2 border-charcoal/10 bg-white p-4">
      <h2 className="font-display text-2xl">{title}</h2>
      {hint && <p className="text-sm text-charcoal/70">{hint}</p>}
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Save({ onClick, busy, label = "حفظ" }: { onClick: () => void; busy: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={btn.primary}>
      {busy ? "بنحفظ…" : label}
    </button>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const { post, busy } = useAdmin();
  const info = settings.restaurant_info;

  const [name, setName] = useState(info.name_ar);
  const [address, setAddress] = useState(info.address_ar);
  const [phone, setPhone] = useState(/^\d+$/.test(info.phone) ? info.phone : "");
  const [wa, setWa] = useState(/^\d+$/.test(info.whatsapp) ? info.whatsapp : "");
  const [fb, setFb] = useState(info.social?.facebook ?? "");
  const [ig, setIg] = useState(info.social?.instagram ?? "");
  const [infoErr, setInfoErr] = useState<Record<string, string>>({});

  const [days, setDays] = useState(settings.opening_hours.days);
  const [hoursErr, setHoursErr] = useState<string | null>(null);

  const [override, setOverride] = useState(settings.open_override);
  const [acceptClosed, setAcceptClosed] = useState(settings.accept_orders_when_closed);
  const [banner, setBanner] = useState(settings.announcement_ar ?? "");

  async function saveInfo() {
    const value = {
      name_ar: name.trim(),
      address_ar: address.trim(),
      phone: digitsOnly(phone),
      whatsapp: toWhatsapp(wa),
      social: { facebook: fb.trim(), instagram: ig.trim() },
    };
    const res = await post("settings", { key: "restaurant_info", value }, "اتحفظت بيانات المطعم");
    if (res.ok) {
      setPhone(value.phone);
      setWa(value.whatsapp);
      setInfoErr({});
    } else setInfoErr({ _: res.error?.message ?? "" });
  }

  async function saveHours() {
    setHoursErr(null);
    const res = await post("settings", { key: "opening_hours", value: { timezone: "Africa/Cairo", days } }, "اتحفظت المواعيد");
    if (!res.ok) setHoursErr(res.error?.message ?? null);
  }

  const setDay = (i: number, patch: Partial<(typeof days)[number]>) => setDays((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // week shown starting Saturday, the way Egyptians read it
  const order = [6, 0, 1, 2, 3, 4, 5];

  return (
    <div>
      <h1 className="font-display text-4xl text-forest">الإعدادات</h1>

      <Card title="الفتح والقفل" hint="المواعيد الأسبوعية بتشتغل لوحدها. تقدر تتجاوزها يدويًا في أي وقت.">
        <Field label="حالة المطعم">
          {(id) => (
            <select id={id} className={inputCls} value={override} onChange={(e) => setOverride(e.target.value as typeof override)}>
              <option value="auto">تلقائي حسب المواعيد</option>
              <option value="open">مفتوح دلوقتي (تجاوز المواعيد)</option>
              <option value="closed">مقفول دلوقتي (تجاوز المواعيد)</option>
            </select>
          )}
        </Field>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-charcoal/5 px-3 py-3">
          <div>
            <p className="font-medium">استقبال طلبات وأنت مقفول</p>
            <p className="text-sm text-charcoal/70">لو مقفول: العميل يشوف المنيو بس مايقدرش يبعت طلب</p>
          </div>
          <Switch label="استقبال طلبات وأنت مقفول" checked={acceptClosed} onChange={setAcceptClosed} />
        </div>
        <Save
          busy={busy}
          onClick={async () => {
            await post("settings", { key: "open_override", value: override });
            await post("settings", { key: "accept_orders_when_closed", value: acceptClosed }, "اتحفظت حالة الفتح");
          }}
        />
      </Card>

      <Card title="مواعيد العمل" hint="بتوقيت القاهرة. لو القفل بعد نص الليل، اكتب وقت قفل أقل من وقت الفتح (مثلًا من 12:00 لـ 01:00).">
        <ul className="divide-y divide-charcoal/10">
          {order.map((d) => {
            const day = days.find((x) => x.day === d)!;
            const i = days.indexOf(day);
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-3" data-day={d}>
                <span className="w-16 font-medium">{DAYS[d]}</span>
                <Switch label={`${DAYS[d]} مفتوح`} checked={!day.closed} onChange={(v) => setDay(i, { closed: !v })} />
                {day.closed ? (
                  <span className="text-charcoal/70">أجازة</span>
                ) : (
                  <span className="flex items-center gap-2" dir="ltr">
                    <input type="time" aria-label={`${DAYS[d]} وقت الفتح`} value={day.open} onChange={(e) => setDay(i, { open: e.target.value })} className={`${inputCls} !w-32`} />
                    <span>→</span>
                    <input type="time" aria-label={`${DAYS[d]} وقت القفل`} value={day.close} onChange={(e) => setDay(i, { close: e.target.value })} className={`${inputCls} !w-32`} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {hoursErr && <p role="alert" className="font-medium text-ember">{hoursErr}</p>}
        <Save busy={busy} onClick={saveHours} />
      </Card>

      <Card title="بيانات المطعم" hint="بتظهر في الصفحة الرئيسية وأزرار الاتصال والواتساب.">
        <Field label="اسم المطعم">{(id) => <input id={id} className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="العنوان">{(id) => <input id={id} className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />}</Field>
        <Field label="رقم التليفون" hint="مثال: 01012345678">
          {(id) => <input id={id} inputMode="tel" dir="ltr" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />}
        </Field>
        <Field label="رقم الواتساب" hint="اكتبه عادي 01012345678 وهنحوله للصيغة الدولية">
          {(id) => <input id={id} inputMode="tel" dir="ltr" className={inputCls} value={wa} onChange={(e) => setWa(e.target.value)} />}
        </Field>
        <Field label="رابط فيسبوك (اختياري)">{(id) => <input id={id} dir="ltr" placeholder="https://facebook.com/…" className={inputCls} value={fb} onChange={(e) => setFb(e.target.value)} />}</Field>
        <Field label="رابط إنستجرام (اختياري)">{(id) => <input id={id} dir="ltr" placeholder="https://instagram.com/…" className={inputCls} value={ig} onChange={(e) => setIg(e.target.value)} />}</Field>
        {infoErr._ && <p role="alert" className="font-medium text-ember">{infoErr._}</p>}
        <Save busy={busy} onClick={saveInfo} />
      </Card>

      <Card title="شريط إعلان" hint="جملة قصيرة بتظهر فوق الموقع كله (مثلًا: إجازة العيد). سيبه فاضي لو مفيش.">
        <Field label="نص الإعلان">
          {(id) => <input id={id} className={inputCls} value={banner} maxLength={160} onChange={(e) => setBanner(e.target.value)} />}
        </Field>
        <Save busy={busy} onClick={() => void post("settings", { key: "announcement_ar", value: banner.trim() }, banner.trim() ? "الإعلان اتنشر" : "الإعلان اتشال")} />
      </Card>
    </div>
  );
}

import Link from "next/link";
import { adminPage } from "@/lib/server/admin-page";
import { getDailySummary } from "@/lib/server/summary";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";
import { getOpenState } from "@/lib/hours";
import type { SiteSettings } from "@/lib/types";
import { ar } from "@/messages/ar";

interface Todo { text: string; href: string; tone?: "warn" | "info" }

export default async function AdminHome() {
  const db = createSupabaseAdmin();
  // the role check (shared with the layout) and every query run side by side
  const [me, summary, items, zones, offers, settingsRes, staff] = await Promise.all([
    adminPage(["owner", "manager"]),
    getDailySummary(),
    db.from("items").select("id, is_sample, image_url, active"),
    db.from("delivery_zones").select("id, is_sample, active"),
    db.from("offers").select("id, is_sample, active"),
    db.from("settings").select("key, value"),
    db.from("profiles").select("user_id").eq("active", true),
  ]);

  const settings = Object.fromEntries((settingsRes.data ?? []).map((r) => [r.key, r.value])) as unknown as SiteSettings;
  const open = getOpenState(settings);
  const live = (items.data ?? []).filter((i) => i.active);
  const sampleItems = (items.data ?? []).filter((i) => i.is_sample).length;
  const noPhoto = live.filter((i) => !i.image_url).length;
  const sampleZones = (zones.data ?? []).filter((z) => z.is_sample).length;
  const sampleOffers = (offers.data ?? []).filter((o) => o.is_sample).length;
  const activeZones = (zones.data ?? []).filter((z) => z.active).length;
  const info = settings.restaurant_info;

  const todos: Todo[] = [];
  if (sampleItems) todos.push({ text: `${sampleItems} صنف تجريبي لسه محتاج مراجعة الاسم والسعر`, href: "/admin/menu", tone: "warn" });
  if (noPhoto) todos.push({ text: `${noPhoto} صنف من غير صورة (بيظهر بلوك ملون مكانها)`, href: "/admin/menu" });
  if (sampleZones) todos.push({ text: `${sampleZones} منطقة توصيل تجريبية. عدّلها أو امسحها`, href: "/admin/zones", tone: "warn" });
  if (activeZones === 0) todos.push({ text: "مفيش مناطق توصيل شغالة: العملاء مش هيقدروا يطلبوا توصيل", href: "/admin/zones", tone: "warn" });
  if (sampleOffers) todos.push({ text: `${sampleOffers} عرض تجريبي ظاهر للعملاء`, href: "/admin/offers", tone: "warn" });
  if (me.role === "owner") {
    if (!/^0\d{9,10}$/.test(info?.phone ?? "") || !/^20\d{10}$/.test(info?.whatsapp ?? "")) {
      todos.push({ text: "رقم التليفون أو الواتساب مش مظبوط", href: "/admin/settings", tone: "warn" });
    }
    if (settings.open_override !== "auto") {
      todos.push({ text: `حالة الفتح يدوية دلوقتي (${settings.open_override === "open" ? "مفتوح" : "مقفول"}) ومش بتتبع المواعيد`, href: "/admin/settings", tone: "warn" });
    }
    todos.push({ text: "راجع مواعيد العمل لو لسه ماظبطتهاش", href: "/admin/settings", tone: "info" });
  }

  const tile = (label: string, value: string, tone = "text-forest") => (
    <div className="rounded-2xl bg-white p-4">
      <dt className="text-sm text-charcoal/65">{label}</dt>
      <dd className={`font-display text-4xl ${tone}`}>{value}</dd>
    </div>
  );

  return (
    <div>
      <h1 className="font-display text-4xl text-forest">أهلًا {me.name}</h1>
      <p className="mt-1 flex items-center gap-2 text-charcoal/70">
        {summary.date} ·
        <span className={`rounded-full px-3 py-0.5 text-sm font-medium ${open.open ? "bg-leaf text-forest-deep" : "bg-charcoal/15"}`}>{open.open ? "مفتوح دلوقتي" : "مقفول دلوقتي"}</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3" data-testid="overview-today">
        {tile("طلبات النهارده", String(summary.orders))}
        {tile("اتسلم", String(summary.delivered))}
        {tile("الإيراد", `${formatMoney(summary.revenue)} ${ar.currency}`, "text-ember")}
        {tile("لسه شغال", `${formatMoney(summary.pending)} ${ar.currency}`, "text-charcoal")}
      </dl>

      <section className="mt-6" aria-labelledby="todo-h">
        <h2 id="todo-h" className="font-display text-2xl">محتاج انتباه</h2>
        {todos.length === 0 ? (
          <p className="mt-2 rounded-2xl bg-leaf/30 p-4">كل حاجة متظبطة، مفيش حاجة محتاجة انتباه.</p>
        ) : (
          <ul className="mt-2 space-y-2" data-testid="todo-list">
            {todos.map((t) => (
              <li key={t.text}>
                <Link href={t.href} className={`flex min-h-12 items-center justify-between gap-3 rounded-2xl p-4 ${t.tone === "warn" ? "bg-saffron/40" : "bg-white"}`}>
                  <span>{t.text}</span>
                  <span aria-hidden>←</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="اختصارات">
        {[
          ["/staff", "لوحة الطلبات"],
          ["/admin/menu", "المنيو"],
          ["/admin/offers", "العروض"],
          ["/admin/zones", "مناطق التوصيل"],
          ["/admin/reports", "التقارير"],
          ...(me.role === "owner" ? [["/admin/settings", "الإعدادات"], ["/admin/staff", `الموظفين (${staff.data?.length ?? 0})`]] : []),
        ].map(([href, label]) => (
          <Link key={href} href={href} className="grid min-h-16 place-items-center rounded-2xl bg-forest p-3 text-center font-display text-xl text-ivory">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

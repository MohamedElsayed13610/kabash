import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { formatKg, formatMoney } from "@/lib/format";
import { ar } from "@/messages/ar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "طلبك | كباش", robots: { index: false } };

// Phase 3 confirmation screen. Phase 4 replaces this with the animated tracking page.
export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z2-9]{6}$/.test(code)) notFound();

  const db = createSupabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, code, customer_name, fulfillment, zone_name, status, subtotal_estimate, delivery_fee, discount_total, total_estimate, has_butcher, created_at")
    .eq("code", code)
    .maybeSingle();
  if (!order) notFound();

  const [{ data: items }, settings] = await Promise.all([
    db.from("order_items").select("name_snapshot, unit, qty_requested, line_total_estimate").eq("order_id", order.id),
    getSettings(),
  ]);

  const wa = settings.restaurant_info.whatsapp;
  const message = encodeURIComponent(
    `أهلاً كباش، أنا ${order.customer_name}. طلبي رقم ${order.code}:\n` +
      (items ?? []).map((i) => `- ${i.name_snapshot} ${i.unit === "kg" ? formatKg(Number(i.qty_requested)) : `×${Number(i.qty_requested)}`}`).join("\n") +
      `\nالإجمالي التقديري: ${formatMoney(Number(order.total_estimate))} ${ar.currency}`,
  );

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <p className="font-display text-2xl text-forest">وصلنا طلبك</p>
      <h1 className="mt-1 font-display text-7xl tracking-widest text-ember" dir="ltr">
        {order.code}
      </h1>
      <p className="mt-2 text-charcoal/75">احتفظ بالكود ده، تتابع بيه طلبك.</p>

      <section className="mt-8 border-y-2 border-dashed border-charcoal/25 py-4">
        <ul className="divide-y divide-charcoal/10">
          {(items ?? []).map((i, idx) => (
            <li key={idx} className="flex justify-between py-2">
              <span>
                {i.name_snapshot}
                <span className="ms-2 text-sm text-charcoal/65">
                  {i.unit === "kg" ? formatKg(Number(i.qty_requested)) : `×${Number(i.qty_requested)}`}
                </span>
              </span>
              <span className="tabular-nums">{formatMoney(Number(i.line_total_estimate))}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1">
          {Number(order.discount_total) > 0 && (
            <div className="flex justify-between text-forest">
              <dt>الخصم</dt>
              <dd>−{formatMoney(Number(order.discount_total))} {ar.currency}</dd>
            </div>
          )}
          {order.fulfillment === "delivery" && (
            <div className="flex justify-between">
              <dt>التوصيل ({order.zone_name})</dt>
              <dd>{Number(order.delivery_fee) === 0 ? "مجاني" : `${formatMoney(Number(order.delivery_fee))} ${ar.currency}`}</dd>
            </div>
          )}
          <div className="flex justify-between font-display text-3xl text-forest">
            <dt>{order.has_butcher ? "الإجمالي التقديري" : "الإجمالي"}</dt>
            <dd>{formatMoney(Number(order.total_estimate))} {ar.currency}</dd>
          </div>
        </dl>
        {order.has_butcher && <p className="mt-2 text-sm text-charcoal/70">{ar.butcher.estimateNote}</p>}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {/^\d+$/.test(wa) && (
          <a href={`https://wa.me/${wa}?text=${message}`} className="grid h-12 place-items-center rounded-full bg-forest px-6 text-ivory">
            ابعت الطلب على واتساب
          </a>
        )}
        <Link href="/menu" className="grid h-12 place-items-center rounded-full border-2 border-forest px-6 text-forest">
          اطلب حاجة تانية
        </Link>
      </div>
    </main>
  );
}

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SlipToolbar } from "@/components/staff/SlipToolbar";
import { getSettings } from "@/lib/data";
import { formatKg, formatMoney } from "@/lib/format";
import { getStaff } from "@/lib/server/staff";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ORDER_SELECT, type BoardOrder } from "@/lib/staff-types";
import { ar } from "@/messages/ar";

export const dynamic = "force-dynamic";
export const metadata = { title: "فاتورة الطلب | كباش" };

const when = (iso: string) =>
  new Date(iso).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" });

/** Thermal-printer slip. 58mm or 80mm via ?w=58|80. Open it and press print (or add ?auto=1). */
export default async function SlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string; auto?: string }>;
}) {
  if (!(await getStaff())) redirect("/staff/login");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const sp = await searchParams;
  const width = sp.w === "58" ? 58 : 80;

  const supa = await createSupabaseServer();
  const { data } = await supa.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const o = data as unknown as BoardOrder;
  const settings = await getSettings();
  const a = o.address_json;
  const final = o.total_final;
  const unweighed = o.order_items.some((i) => i.kind === "butcher" && i.qty_final === null);

  return (
    <div className="slip-root min-h-dvh bg-charcoal/10 print:bg-white">
      <style>{`
        @page { size: ${width}mm auto; margin: 0; }
        .slip { width: ${width}mm; font-size: ${width === 58 ? 12 : 14}px; line-height: 1.45; }
        @media print {
          .no-print { display: none !important; }
          .slip-root { background: #fff !important; min-height: 0 !important; padding: 0 !important; }
          .slip { box-shadow: none !important; margin: 0 !important; padding: 2mm 3mm !important; }
        }
      `}</style>

      <SlipToolbar width={width} id={id} auto={sp.auto === "1"} />

      <div className="slip mx-auto my-4 bg-white p-3 text-black shadow print:my-0" dir="rtl" data-testid="slip">
        <header className="border-b border-dashed border-black pb-2 text-center">
          <p className="font-display text-3xl leading-none">{ar.brand.name}</p>
          <p>{settings.restaurant_info.address_ar}</p>
          {/^\d+$/.test(settings.restaurant_info.phone) && <p dir="ltr">{settings.restaurant_info.phone}</p>}
        </header>

        <section className="border-b border-dashed border-black py-2 text-center">
          <p className="font-display text-4xl tracking-widest" dir="ltr">
            {o.code}
          </p>
          <p>{when(o.created_at)}</p>
          <p className="font-bold">
            {o.fulfillment === "delivery" ? "توصيل" : "استلام من المحل"}
            {o.has_butcher ? " · جزارة" : ""}
            {o.has_restaurant ? " · مطعم" : ""}
          </p>
        </section>

        <section className="border-b border-dashed border-black py-2">
          <p className="font-bold">{o.customer_name}</p>
          <p dir="ltr" className="text-end">
            {o.phone}
          </p>
          {o.fulfillment === "delivery" && a && (
            <p>
              {o.zone_name}
              {a.street ? ` - ${a.street}` : ""}
              {a.building ? ` - عمارة/شقة ${a.building}` : ""}
              {a.landmark ? ` - جنب ${a.landmark}` : ""}
            </p>
          )}
          {o.notes && <p className="mt-1 font-bold">ملاحظات: {o.notes}</p>}
        </section>

        <table className="w-full border-b border-dashed border-black py-2">
          <tbody>
            {o.order_items.map((i) => {
              const weighed = i.kind === "butcher" && i.qty_final !== null;
              const snap = i.variant_snapshot;
              return (
                <tr key={i.id} className="align-top">
                  <td className="py-1 pe-2">
                    <b>{i.unit === "kg" ? formatKg(weighed ? i.qty_final! : i.qty_requested) : `${i.qty_requested}×`}</b> {i.name_snapshot}
                    {snap?.variant?.name ? ` (${snap.variant.name})` : ""}
                    {snap?.extras && snap.extras.length > 0 && <div className="text-[0.85em]">+ {snap.extras.map((e) => e.name).join("، ")}</div>}
                    {i.kind === "butcher" && !weighed && <div className="text-[0.85em]">(تقديري - لسه متوزنش)</div>}
                  </td>
                  <td className="whitespace-nowrap py-1 text-end tabular-nums" dir="ltr">
                    {formatMoney(weighed ? (i.line_total_final ?? 0) : i.line_total_estimate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="space-y-0.5 py-2">
          {o.discount_total > 0 && (
            <div className="flex justify-between">
              <dt>خصم</dt>
              <dd dir="ltr">-{formatMoney(o.discount_total)}</dd>
            </div>
          )}
          {o.fulfillment === "delivery" && (
            <div className="flex justify-between">
              <dt>توصيل</dt>
              <dd dir="ltr">{formatMoney(o.delivery_fee)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-black pt-1 text-[1.25em] font-bold">
            <dt>{final !== null ? "الإجمالي" : "الإجمالي (تقديري)"}</dt>
            <dd dir="ltr">
              {formatMoney(final ?? o.total_estimate)} {ar.currency}
            </dd>
          </div>
        </dl>
        {unweighed && <p className="text-center text-[0.85em]">السعر النهائي بعد وزن اللحوم</p>}
        <p className="border-t border-dashed border-black pt-2 text-center">الدفع: كاش عند الاستلام</p>
        <p className="text-center">شكرًا لاختيارك كباش</p>
      </div>
    </div>
  );
}

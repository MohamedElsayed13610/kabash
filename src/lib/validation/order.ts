import { z } from "zod";

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** "+20 10 1234 5678", "٠١٠١٢٣٤٥٦٧٨" -> "01012345678". Returns the cleaned string (may still be invalid). */
export function normalizePhone(raw: string): string {
  let s = [...raw]
    .map((ch) => {
      const a = ARABIC_INDIC.indexOf(ch);
      if (a >= 0) return String(a);
      const p = PERSIAN.indexOf(ch);
      return p >= 0 ? String(p) : ch;
    })
    .join("")
    .replace(/[\s\-().]/g, "");
  if (s.startsWith("+20")) s = "0" + s.slice(3);
  else if (s.startsWith("0020")) s = "0" + s.slice(4);
  else if (/^20\d{10}$/.test(s)) s = "0" + s.slice(2);
  return s;
}

export const EGYPT_MOBILE = /^01[0125]\d{8}$/;

export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .refine((v) => EGYPT_MOBILE.test(v), "رقم الموبايل مش صحيح. اكتبه بالشكل ده: 01012345678");

export const lineSchema = z.object({
  itemId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  extraIds: z.array(z.string().uuid()).max(10).default([]),
  qty: z.number().finite().positive().max(50),
});

const clean = (max: number) => z.string().trim().max(max);

/** What the browser may send. Note there are no prices anywhere: unknown keys are stripped. */
export const orderSchema = z
  .object({
    name: z.string().trim().min(2, "اكتب اسمك").max(60),
    phone: phoneSchema,
    fulfillment: z.enum(["delivery", "pickup"]),
    zoneId: z.string().uuid().nullish(),
    address: z
      .object({
        street: clean(120).default(""),
        building: clean(60).default(""),
        landmark: clean(120).default(""),
      })
      .default({ street: "", building: "", landmark: "" }),
    notes: clean(300).default(""),
    payment: z.literal("cash").default("cash"),
    lines: z.array(lineSchema).min(1, "الصينية فاضية").max(30),
    website: z.string().max(200).optional(), // honeypot: real people leave it empty; the route fakes success if it is filled
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery") {
      if (!v.zoneId) ctx.addIssue({ code: "custom", path: ["zoneId"], message: "اختار منطقة التوصيل" });
      if (v.address.street.length < 3) {
        ctx.addIssue({ code: "custom", path: ["address", "street"], message: "اكتب اسم الشارع أو العنوان" });
      }
    }
  });

export type OrderInput = z.infer<typeof orderSchema>;

/** For /api/quote: just enough to price a cart. */
export const quoteSchema = z.object({
  fulfillment: z.enum(["delivery", "pickup"]),
  zoneId: z.string().uuid().nullish(),
  lines: z.array(lineSchema).min(1).max(30),
});

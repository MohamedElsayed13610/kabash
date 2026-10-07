import { z } from "zod";

const uuid = z.string().uuid();
const money = z.number().finite().min(0).max(100000);
const text = (min: number, max: number, msg = "مطلوب") => z.string().trim().min(min, msg).max(max);
const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

/** Only images we uploaded to our own public bucket are accepted, never arbitrary URLs. */
export const imageUrl = z
  .string()
  .max(500)
  .nullish()
  .refine(
    (v) => !v || v.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu/`),
    "الصورة لازم تترفع من لوحة التحكم",
  )
  .transform((v) => v || null);

// ---------- categories ----------
export const categoryOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), type: z.enum(["restaurant", "butcher"]), name_ar: text(2, 60, "اكتب اسم القسم") }),
  z.object({ op: z.literal("update"), id: uuid, name_ar: text(2, 60).optional(), active: z.boolean().optional() }),
  z.object({ op: z.literal("delete"), id: uuid }),
  z.object({ op: z.literal("reorder"), ids: z.array(uuid).min(1).max(100) }),
]);

// ---------- items ----------
export const itemFields = z
  .object({
    category_id: uuid,
    name_ar: text(2, 80, "اكتب اسم الصنف"),
    description_ar: optText(400),
    unit: z.enum(["piece", "kg"]),
    base_price: money,
    min_qty: z.number().finite().min(0.05).max(50),
    step_qty: z.number().finite().min(0.05).max(50),
    serving_tag: optText(60),
    image_url: imageUrl,
    available: z.boolean(),
    active: z.boolean(),
    featured: z.boolean(),
    is_sample: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.unit === "piece" && (!Number.isInteger(v.min_qty) || !Number.isInteger(v.step_qty))) {
      ctx.addIssue({ code: "custom", path: ["min_qty"], message: "الأصناف بالقطعة لازم تكون أرقام صحيحة" });
    }
  });

export const itemOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("save"),
    id: uuid.optional(),
    item: itemFields,
    variants: z.array(z.object({ name_ar: text(1, 40, "اسم الحجم ناقص"), price_delta: z.number().finite().min(-100000).max(100000) })).max(10),
    extras: z.array(z.object({ name_ar: text(1, 40, "اسم الإضافة ناقص"), price: money })).max(15),
  }),
  z.object({ op: z.literal("patch"), id: uuid, available: z.boolean().optional(), active: z.boolean().optional(), featured: z.boolean().optional() }),
  z.object({ op: z.literal("delete"), id: uuid }),
  z.object({ op: z.literal("reorder"), ids: z.array(uuid).min(1).max(300) }),
]);

// ---------- offers ----------
const isoOrNull = z.string().datetime({ offset: true }).nullish().transform((v) => v ?? null);
export const offerFields = z
  .object({
    title_ar: text(2, 80, "اكتب عنوان العرض"),
    description_ar: optText(300),
    image_url: imageUrl,
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z.number().finite().positive().max(100000),
    target_type: z.enum(["item", "category", "cart"]),
    target_id: uuid.nullish().transform((v) => v ?? null),
    starts_at: isoOrNull,
    ends_at: isoOrNull,
    active: z.boolean(),
    is_sample: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.discount_type === "percent" && v.discount_value > 100) {
      ctx.addIssue({ code: "custom", path: ["discount_value"], message: "النسبة مينفعش تعدي 100" });
    }
    if (v.target_type !== "cart" && !v.target_id) {
      ctx.addIssue({ code: "custom", path: ["target_id"], message: "اختار الصنف أو القسم" });
    }
    if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "تاريخ النهاية لازم يكون بعد البداية" });
    }
  });

export const offerOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("save"), id: uuid.optional(), offer: offerFields }),
  z.object({ op: z.literal("patch"), id: uuid, active: z.boolean() }),
  z.object({ op: z.literal("delete"), id: uuid }),
]);

// ---------- zones ----------
export const zoneFields = z.object({
  name_ar: text(2, 60, "اكتب اسم المنطقة"),
  fee: money,
  min_order: money,
  eta_minutes: z.number().int().min(1).max(600).nullish().transform((v) => v ?? null),
  active: z.boolean(),
  is_sample: z.boolean(),
});

export const zoneOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("save"), id: uuid.optional(), zone: zoneFields }),
  z.object({ op: z.literal("patch"), id: uuid, active: z.boolean() }),
  z.object({ op: z.literal("delete"), id: uuid }),
  z.object({ op: z.literal("reorder"), ids: z.array(uuid).min(1).max(100) }),
]);

// ---------- settings ----------
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت بالشكل ده 13:30");
const digits = (re: RegExp, msg: string) => z.string().trim().refine((v) => v === "" || re.test(v), msg);

export const settingSchemas = {
  restaurant_info: z.object({
    name_ar: text(2, 60),
    address_ar: text(3, 200, "اكتب العنوان"),
    phone: digits(/^0\d{9,10}$/, "رقم التليفون مش صحيح، مثال 01012345678"),
    whatsapp: digits(/^20\d{10}$/, "واتساب بالشكل الدولي من غير +، مثال 201012345678"),
    social: z.object({ facebook: digits(/^(https:\/\/.{3,200})?$/, "الرابط لازم يبدأ بـ https://"), instagram: digits(/^(https:\/\/.{3,200})?$/, "الرابط لازم يبدأ بـ https://") }),
  }),
  opening_hours: z.object({
    timezone: z.literal("Africa/Cairo"),
    days: z.array(z.object({ day: z.number().int().min(0).max(6), open: hhmm, close: hhmm, closed: z.boolean() })).length(7),
  }),
  open_override: z.enum(["auto", "open", "closed"]),
  accept_orders_when_closed: z.boolean(),
  free_delivery_threshold: z.number().finite().positive().max(1000000).nullable(),
  announcement_ar: z.string().trim().max(160),
} as const;

export type SettingKey = keyof typeof settingSchemas;

export const settingOp = z.object({
  key: z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]),
  value: z.unknown(),
});

// ---------- staff ----------
const password = z.string().min(8, "كلمة السر 8 حروف على الأقل").max(72);
export const staffOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), email: z.string().trim().email("الإيميل مش صحيح").max(120), name: text(2, 60, "اكتب الاسم"), role: z.enum(["owner", "manager", "cashier"]), password }),
  z.object({ op: z.literal("update"), userId: uuid, name: text(2, 60).optional(), role: z.enum(["owner", "manager", "cashier"]).optional(), active: z.boolean().optional() }),
  z.object({ op: z.literal("password"), userId: uuid, password }),
  z.object({ op: z.literal("delete"), userId: uuid }),
]);

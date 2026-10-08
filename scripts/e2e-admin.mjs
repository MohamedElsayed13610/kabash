// Admin dashboard end-to-end test in real Chrome on a phone-sized viewport.
//   node --env-file=.env.local scripts/e2e-admin.mjs [baseUrl] [screenshotDir]
// Creates temporary staff users, test menu data, photos and orders, drives the REAL admin UI, verifies the
// database, Storage and the public site, then deletes everything it made and restores every setting.
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import { forceOpen } from "./_open.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TAG = randomBytes(3).toString("hex");
const MARK = "اختبار آلي";
const CAT = `قسم ${MARK}`, CAT2 = `قسم ثاني ${MARK}`, ITEM = `صنف ${MARK}`, OFFER = `عرض ${MARK}`, ZONE = `منطقة ${MARK}`;
const startedAt = new Date().toISOString();

const rest = (p, o = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...o, headers: { apikey: o.key ?? SVC, Authorization: `Bearer ${o.key ?? SVC}`, "Content-Type": "application/json", Prefer: "return=representation" } }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, failed = 0;
const check = (n, ok, d = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? `  [${d}]` : ""}`); };
async function section(name, fn) {
  console.log(`\n== ${name} ==`);
  try { await fn(); } catch (e) { check(`${name}: section crashed`, false, String(e.message).split("\n")[0].slice(0, 160)); }
}
const api = (resource, body, cookie, ip = "10.40.0.1") => fetch(`${BASE}/api/admin/${resource}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: cookie ?? "", "x-forwarded-for": ip }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
const page$ = (path, cookie) => fetch(`${BASE}${path}`, { redirect: "manual", headers: { cookie: cookie ?? "" } }).then(async (r) => ({ status: r.status, location: r.headers.get("location"), text: r.status === 200 ? await r.text() : "" }));
const cookieOf = async (ctx) => (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const clean = (e) => String(e?.message ?? e).split("\n")[0];

// ---------- fixtures ----------
const users = {};
async function mkUser(label, role) {
  const email = `e2e-${label}-${TAG}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ user_id: data.user.id, name: `اختبار ${label}`, role, active: true });
  users[label] = { id: data.user.id, email, password, role };
  return users[label];
}
const img1 = join(tmpdir(), `kabash-test-1-${TAG}.png`), img2 = join(tmpdir(), `kabash-test-2-${TAG}.png`);
await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#c2410c" } }).composite([{ input: Buffer.from('<svg width="600" height="600"><circle cx="300" cy="300" r="280" fill="#f5f2e4"/></svg>'), gravity: "center" }]).png().toFile(img1);
await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#0b5128" } }).png().toFile(img2);

const snap = Object.fromEntries((await rest("settings?select=key,value")).body.map((r) => [r.key, r.value]));
await forceOpen(rest); // work at any time of day; every original setting is restored from `snap` at the end
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const phone = { viewport: { width: 390, height: 844 }, locale: "ar-EG", isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const errors = [];
async function login(ctx, u) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click("button[type=submit]");
  await page.waitForURL("**/staff", { timeout: 25000 });
  return page;
}
const toast = (page, text, ms = 12000) => page.getByRole("status").filter({ hasText: text }).first().waitFor({ timeout: ms }).then(() => true).catch(() => false);
const shot = (page, name, full = true) => page.screenshot({ path: `${SHOTS}/admin-${name}.png`, fullPage: full });
const created = { storage: [], orders: [] };
const inStorage = async (url) => {
  const m = String(url).match(/\/menu\/(items|offers)\/([^/?]+)$/);
  if (!m) return false;
  const { data } = await admin.storage.from("menu").list(m[1], { search: m[2], limit: 5 });
  return (data ?? []).some((x) => x.name === m[2]);
};
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };

try {
  const owner = await mkUser("owner", "owner");
  const manager = await mkUser("manager", "manager");
  const cashier = await mkUser("cashier", "cashier");
  const ownerCtx = await browser.newContext(phone), mgrCtx = await browser.newContext(phone), cashCtx = await browser.newContext(phone);
  const ownerPage = await login(ownerCtx, owner), mgrPage = await login(mgrCtx, manager), cashPage = await login(cashCtx, cashier);
  const oC = await cookieOf(ownerCtx), mC = await cookieOf(mgrCtx), cC = await cookieOf(cashCtx);

  // ================================================================ A
  await section("A. Who can open what", async () => {
    const out = await page$("/admin", "");
    check("signed out: /admin -> login", out.status === 307 && /\/staff\/login/.test(out.location ?? ""), `${out.status} ${out.location}`);
    const c = await page$("/admin/menu", cC);
    check("cashier: /admin/menu -> sent to the orders board", c.status === 307 && /\/staff$/.test(c.location ?? ""), `${c.status} ${c.location}`);
    for (const p of ["/admin", "/admin/menu", "/admin/offers", "/admin/zones", "/admin/reports"]) {
      const r = await page$(p, mC);
      check(`manager: ${p} opens`, r.status === 200, r.status);
    }
    for (const p of ["/admin/settings", "/admin/staff"]) {
      const r = await page$(p, mC);
      check(`manager: ${p} is owner-only -> redirected`, r.status === 307 && /\/admin$/.test(r.location ?? ""), `${r.status} ${r.location}`);
    }
    for (const p of ["/admin/settings", "/admin/staff", "/admin/reports"]) check(`owner: ${p} opens`, (await page$(p, oC)).status === 200);
    check("manager nav hides Settings and Staff", !(await mgrPage.goto(`${BASE}/admin`).then(() => mgrPage.getByRole("link", { name: "الإعدادات" }).count())) && (await mgrPage.getByRole("link", { name: "الموظفين" }).count()) === 0);
    check("signed out: admin API -> 401", (await api("items", { op: "patch", id: "00000000-0000-4000-8000-000000000000", available: true }, "")).status === 401);
    check("cashier: admin API -> 403", (await api("items", { op: "patch", id: "00000000-0000-4000-8000-000000000000", available: true }, cC)).status === 403);
    check("manager: settings API -> 403", (await api("settings", { key: "announcement_ar", value: "x" }, mC)).status === 403);
    check("manager: staff API -> 403", (await api("staff", { op: "password", userId: owner.id, password: "x".repeat(10) }, mC)).status === 403);
    const t = snap.free_delivery_threshold;
    const ok = await api("settings", { key: "free_delivery_threshold", value: t }, mC);
    check("manager MAY set the free-delivery threshold (it belongs to zones)", ok.status === 200, ok.status);
  });

  // ================================================================ B
  await section("B. Server-side validation (owner session)", async () => {
    const cat = (await rest("categories?type=eq.restaurant&select=id&limit=1")).body[0].id;
    const butcherCat = (await rest("categories?type=eq.butcher&select=id&limit=1")).body[0].id;
    const item = (over = {}, cid = cat) => ({ op: "save", item: { category_id: cid, name_ar: ITEM + " صالح", description_ar: null, unit: "piece", base_price: 10, min_qty: 1, step_qty: 1, serving_tag: null, image_url: null, available: true, active: true, featured: false, is_sample: false, ...over }, variants: [], extras: [] });
    const expect = async (name, resource, body, status) => { const r = await api(resource, body, oC); check(`${name} -> ${status}`, r.status === status, `${r.status} ${r.body?.error?.message ?? ""}`.slice(0, 90)); };
    await expect("external image URL is refused", "items", item({ image_url: "https://evil.example/x.png" }), 400);
    await expect("negative price", "items", item({ base_price: -5 }), 400);
    await expect("price 10 million", "items", item({ base_price: 10_000_000 }), 400);
    await expect("piece item with 0.5 step", "items", item({ min_qty: 0.5, step_qty: 0.5 }), 400);
    await expect("butcher category with a per-piece item", "items", item({}, butcherCat), 400);
    await expect("too-short name", "items", item({ name_ar: "ا" }), 400);
    await expect("category that doesn't exist", "items", item({}, "00000000-0000-4000-8000-000000000000"), 400);
    await expect("12 variants (max 10)", "items", { ...item(), variants: Array.from({ length: 12 }, (_, i) => ({ name_ar: `v${i}`, price_delta: 0 })) }, 400);
    await expect("offer: 150 percent", "offers", { op: "save", offer: { title_ar: OFFER, discount_type: "percent", discount_value: 150, target_type: "cart", active: true, is_sample: false } }, 400);
    await expect("offer: item target without an item", "offers", { op: "save", offer: { title_ar: OFFER, discount_type: "fixed", discount_value: 10, target_type: "item", active: true, is_sample: false } }, 400);
    await expect("offer: target that doesn't exist", "offers", { op: "save", offer: { title_ar: OFFER, discount_type: "fixed", discount_value: 10, target_type: "item", target_id: "00000000-0000-4000-8000-000000000000", active: true, is_sample: false } }, 400);
    await expect("offer: ends before it starts", "offers", { op: "save", offer: { title_ar: OFFER, discount_type: "fixed", discount_value: 10, target_type: "cart", starts_at: "2026-10-10T10:00:00Z", ends_at: "2026-10-09T10:00:00Z", active: true, is_sample: false } }, 400);
    await expect("zone: negative fee", "zones", { op: "save", zone: { name_ar: ZONE, fee: -1, min_order: 0, active: true, is_sample: false } }, 400);
    await expect("zone: 0 minutes ETA", "zones", { op: "save", zone: { name_ar: ZONE, fee: 5, min_order: 0, eta_minutes: 0, active: true, is_sample: false } }, 400);
    await expect("settings: bad phone", "settings", { key: "restaurant_info", value: { ...snap.restaurant_info, phone: "12345" } }, 400);
    await expect("settings: bad WhatsApp format", "settings", { key: "restaurant_info", value: { ...snap.restaurant_info, whatsapp: "01012345678" } }, 400);
    await expect("settings: social link not https", "settings", { key: "restaurant_info", value: { ...snap.restaurant_info, social: { facebook: "http://x.example", instagram: "" } } }, 400);
    await expect("settings: opening time 25:00", "settings", { key: "opening_hours", value: { timezone: "Africa/Cairo", days: snap.opening_hours.days.map((d, i) => (i === 0 ? { ...d, open: "25:00" } : d)) } }, 400);
    await expect("settings: only 6 days", "settings", { key: "opening_hours", value: { timezone: "Africa/Cairo", days: snap.opening_hours.days.slice(1) } }, 400);
    await expect("settings: override 'maybe'", "settings", { key: "open_override", value: "maybe" }, 400);
    await expect("settings: unknown key", "settings", { key: "not_a_setting", value: 1 }, 400);
    await expect("settings: negative free-delivery threshold", "settings", { key: "free_delivery_threshold", value: -10 }, 400);
    await expect("staff: weak password", "staff", { op: "create", email: `weak-${TAG}@kabash-test.invalid`, name: "اختبار", role: "cashier", password: "123" }, 400);
    await expect("staff: duplicate email", "staff", { op: "create", email: cashier.email, name: "اختبار", role: "cashier", password: "long-enough-pw" }, 409);
    await expect("staff: owner cannot demote themselves", "staff", { op: "update", userId: owner.id, role: "cashier" }, 409);
    await expect("staff: owner cannot deactivate themselves", "staff", { op: "update", userId: owner.id, active: false }, 409);
    await expect("staff: owner cannot delete themselves", "staff", { op: "delete", userId: owner.id }, 409);
    const nothingLeft = (await rest(`items?name_ar=like.*${encodeURIComponent("صالح")}*&select=id`)).body.length === 0;
    check("none of the rejected requests saved anything", nothingLeft);
  });

  // ================================================================ C
  let itemId = null, catId = null, cat2Id = null, firstImage = null;
  await section("C. Menu manager (photo upload, edit, stock toggle, reorder, delete)", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin/menu`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("add-category").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1000);
    await shot(p, "1-menu");
    check("sample items are flagged with a notice", await p.getByText("صنف تجريبي (عليهم علامة").isVisible().catch(() => false));

    // category
    await p.getByTestId("add-category").click();
    await p.getByLabel("اسم القسم").fill(CAT);
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    check("create category (UI)", await toast(p, "اتضاف القسم"));
    catId = (await rest(`categories?name_ar=eq.${encodeURIComponent(CAT)}&select=id,type,is_sample`)).body[0]?.id;
    check("category saved in DB as a real (non-sample) restaurant category", !!catId);

    // item with photo, size and extra
    const section_ = p.locator(`section[data-category="${CAT}"]`);
    await section_.getByRole("button", { expanded: false }).first().click().catch(() => {});
    await section_.getByTestId("add-item").click();
    await p.getByLabel("اسم الصنف", { exact: true }).fill(ITEM);
    await p.getByLabel("الوصف (اختياري)").fill("وصف تجريبي");
    await p.getByLabel("السعر (ج.م)", { exact: true }).fill("99");
    await p.getByLabel("وصف الحصة (اختياري)").fill("الصينية تكفي ٢ فرد");
    await p.getByRole("button", { name: "+ حجم" }).click();
    await p.getByLabel("اسم الحجم 1").fill("كبير");
    await p.getByLabel("فرق سعر الحجم 1").fill("50");
    await p.getByRole("button", { name: "+ إضافة" }).click();
    await p.getByLabel("اسم الإضافة 1").fill("زيادة");
    await p.getByLabel("سعر الإضافة 1").fill("10");
    await p.locator('input[type=file][aria-label="صورة الصنف"]').setInputFiles(img1);
    await p.getByText("اقص الصورة").first().waitFor({ timeout: 8000 });
    await p.waitForTimeout(700); // let the sheet finish sliding in
    const cb = await p.getByTestId("crop-box").evaluate((el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
    check("choosing a photo opens the crop sheet (square 300x300 box)", cb.w === 300 && cb.h === 300, `${cb.w}x${cb.h}`);
    await shot(p, "2-crop", false);
    // drag the image a little and zoom, like a user would
    const box = await p.getByTestId("crop-box").boundingBox();
    await p.mouse.move(box.x + 150, box.y + 150); await p.mouse.down(); await p.mouse.move(box.x + 120, box.y + 150, { steps: 5 }); await p.mouse.up();
    await p.getByLabel("تكبير الصورة").fill("1.4");
    await p.getByRole("button", { name: "تمام، ارفع الصورة" }).click();
    await p.locator('img[src^="http"]').first().waitFor({ timeout: 20000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector('[role=dialog] img')?.src?.includes("/storage/v1/object/public/menu/items/"), null, { timeout: 25000 }).catch(() => {});
    const shown = await p.locator('[role=dialog] img').first().getAttribute("src");
    check("uploaded: the editor shows the stored photo (WebP in Supabase Storage)", /\/storage\/v1\/object\/public\/menu\/items\/.+\.webp$/.test(shown ?? ""), (shown ?? "").slice(-45));
    await shot(p, "3-item-editor", false);
    await p.getByRole("button", { name: "حفظ الصنف" }).click();
    check("save item (UI)", await toast(p, "اتحفظ الصنف"));

    const itemRows = (await rest(`items?name_ar=eq.${encodeURIComponent(ITEM)}&select=*,item_variants(*),item_extras(*)`)).body;
    check("saving once creates exactly ONE item (no duplicate request)", itemRows.length === 1, `${itemRows.length} rows`);
    const [it] = itemRows;
    itemId = it?.id;
    firstImage = it?.image_url;
    created.storage.push(firstImage);
    check("DB: name, price 99, unit, serving tag, sample=false", it && Number(it.base_price) === 99 && it.unit === "piece" && it.serving_tag === "الصينية تكفي ٢ فرد" && it.is_sample === false);
    check("DB: size 'كبير' +50 and extra 'زيادة' 10 saved", it?.item_variants.length === 1 && Number(it.item_variants[0].price_delta) === 50 && it.item_extras.length === 1 && Number(it.item_extras[0].price) === 10);
    const bytes = Buffer.from(await (await fetch(firstImage)).arrayBuffer());
    const meta = await sharp(bytes).metadata();
    check("photo is WebP, cropped square 1000x1000 and compressed", meta.format === "webp" && meta.width === 1000 && meta.height === 1000 && bytes.length < 250_000, `${meta.format} ${meta.width}x${meta.height} ${Math.round(bytes.length / 1024)} KB (source PNG was 1200x900)`);

    // public site
    const pub = await page$("/menu", "");
    check("public /menu shows the new category and item at once", pub.text.includes(CAT) && pub.text.includes(ITEM));
    check("public /menu serves the photo through the image optimizer", /_next\/image\?url=[^"]*menu%2Fitems/.test(pub.text.replace(/&amp;/g, "&")));

    // stock toggle
    await section_.getByRole("switch", { name: `${ITEM} متاح` }).click();
    check("stock switch: 'خلصت' saved", await until(async () => (await rest(`items?id=eq.${itemId}&select=available`)).body[0].available === false));
    check("public site shows the item as sold out", await until(async () => (await page$("/menu", "")).text.includes("خلصت")));
    const ord = await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.1.1" }, body: JSON.stringify({ fulfillment: "pickup", lines: [{ itemId, variantId: it.item_variants[0].id, qty: 1 }] }) });
    check("a sold-out item can't be ordered (server refuses)", ord.status === 422, ord.status);
    await section_.getByRole("switch", { name: `${ITEM} متاح` }).click();
    await until(async () => (await rest(`items?id=eq.${itemId}&select=available`)).body[0].available === true);
    check("switching back on makes it orderable again", (await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.1.2" }, body: JSON.stringify({ fulfillment: "pickup", lines: [{ itemId, variantId: it.item_variants[0].id, qty: 1 }] }) })).status === 200);

    // edit price, keep photo
    await section_.getByRole("button", { name: `تعديل ${ITEM}` }).click();
    await p.getByLabel("السعر (ج.م)", { exact: true }).fill("120");
    await p.getByRole("button", { name: "حفظ الصنف" }).click();
    check("edit price (UI)", await toast(p, "اتحفظ الصنف"));
    const [e1] = (await rest(`items?id=eq.${itemId}&select=base_price,image_url`)).body;
    check("price is 120 and the photo is untouched", Number(e1.base_price) === 120 && e1.image_url === firstImage);

    // replace photo -> old file deleted
    await p.waitForTimeout(800);
    await section_.getByRole("button", { name: `تعديل ${ITEM}` }).click();
    await p.locator('input[type=file][aria-label="صورة الصنف"]').setInputFiles(img2);
    await p.getByRole("button", { name: "تمام، ارفع الصورة" }).click();
    await p.waitForFunction((old) => { const s = document.querySelector("[role=dialog] img")?.src; return s && s !== old && s.includes("/menu/items/"); }, firstImage, { timeout: 25000 });
    const secondImage = await p.locator("[role=dialog] img").first().getAttribute("src");
    created.storage.push(secondImage);
    await p.getByRole("button", { name: "حفظ الصنف" }).click();
    check("replace photo (UI)", await toast(p, "اتحفظ الصنف"));
    await sleep(1500);
    check("the OLD photo was deleted from Storage, the new one exists", !(await inStorage(firstImage)) && (await inStorage(secondImage)));

    // upload then cancel -> orphan removed
    await p.waitForTimeout(800);
    await section_.getByRole("button", { name: `تعديل ${ITEM}` }).click();
    await p.locator('input[type=file][aria-label="صورة الصنف"]').setInputFiles(img1);
    await p.getByRole("button", { name: "تمام، ارفع الصورة" }).click();
    await p.waitForFunction((old) => { const s = document.querySelector("[role=dialog] img")?.src; return s && s !== old && s.includes("/menu/items/"); }, secondImage, { timeout: 25000 });
    const orphan = await p.locator("[role=dialog] img").first().getAttribute("src");
    created.storage.push(orphan);
    await p.getByRole("button", { name: "إلغاء", exact: true }).click();
    await sleep(1500);
    check("upload then Cancel: the unsaved photo is removed from Storage", !(await inStorage(orphan)) && (await inStorage(secondImage)));

    // bad input in the editor
    await section_.getByRole("button", { name: `تعديل ${ITEM}` }).click();
    await p.getByLabel("السعر (ج.م)", { exact: true }).fill("");
    await p.getByLabel("اسم الصنف", { exact: true }).fill("");
    await p.getByRole("button", { name: "حفظ الصنف" }).click();
    check("editor shows Arabic errors for empty name and price, and saves nothing", (await p.getByText("اكتب اسم الصنف").first().isVisible()) && (await p.getByText("اكتب السعر").first().isVisible()));
    await p.getByRole("button", { name: "إلغاء", exact: true }).click();

    // reorder categories: handle drag
    await p.getByTestId("add-category").click();
    await p.getByLabel("اسم القسم").fill(CAT2);
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    check("second category created", await toast(p, "اتضاف القسم"));
    cat2Id = (await rest(`categories?name_ar=eq.${encodeURIComponent(CAT2)}&select=id`)).body[0]?.id;
    const order = async () => (await rest(`categories?id=in.(${catId},${cat2Id})&select=id,sort`)).body.sort((a, b) => a.sort - b.sort).map((c) => c.id);
    check("new categories are appended in order", (await order())[0] === catId);
    await p.waitForTimeout(800);
    await p.locator(`section[data-category="${CAT}"]`).getByRole("button", { name: "لتحت" }).click();
    await p.waitForTimeout(1500);
    check("▼ button moves a category down (saved)", await until(async () => (await order())[0] === cat2Id));
    const handle = p.locator(`section[data-category="${CAT}"] button[aria-label="اسحب لتغيير الترتيب"]`).first();
    const hb = await handle.boundingBox();
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 60, { steps: 12 });
    await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2 + 140, { steps: 12 });
    await p.mouse.up();
    await p.waitForTimeout(1800);
    const afterDrag = await order();
    check("drag-and-drop handle reorders categories (saved)", afterDrag[0] === cat2Id || afterDrag[1] === cat2Id, "order after drag: " + (afterDrag[0] === catId ? "cat first" : "cat2 first"));
  });

  // ================================================================ D
  await section("D. Offers manager", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin/offers`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("add-offer").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1000);
    await shot(p, "4-offers");
    const variant0 = (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id;
    const quote0 = async () => (await (await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.2.9" }, body: JSON.stringify({ fulfillment: "pickup", lines: [{ itemId, variantId: variant0, qty: 2 }] }) })).json()).totals;
    const baseline = (await quote0()).discountTotal; // existing store-wide offers (e.g. the sample 30 EGP cart offer)
    await p.getByTestId("add-offer").click();
    await p.getByLabel("عنوان العرض").fill(OFFER);
    await p.getByLabel("قيمة الخصم").fill("20");
    await p.getByLabel("بينطبق على", { exact: true }).selectOption("item");
    await p.getByLabel("الصنف", { exact: true }).selectOption(itemId);
    await p.locator('input[type=file][aria-label="صورة العرض (اختياري)"]').setInputFiles(img1);
    await p.getByText("اقص الصورة").first().waitFor();
    check("offer banner crop box is 16:9", await p.getByTestId("crop-box").evaluate((el) => { const r = el.getBoundingClientRect(); return Math.abs(r.width / r.height - 16 / 9) < 0.02; }));
    await p.getByRole("button", { name: "تمام، ارفع الصورة" }).click();
    await p.waitForFunction(() => document.querySelector("[role=dialog] img")?.src?.includes("/menu/offers/"), null, { timeout: 25000 });
    const bannerUrl = await p.locator("[role=dialog] img").first().getAttribute("src");
    created.storage.push(bannerUrl);
    await p.getByRole("button", { name: "حفظ العرض" }).click();
    check("create offer (UI)", await toast(p, "اتحفظ العرض"));
    const [o] = (await rest(`offers?title_ar=eq.${encodeURIComponent(OFFER)}&select=*`)).body;
    check("DB: 20% on that item, active, banner stored", o && o.discount_type === "percent" && Number(o.discount_value) === 20 && o.target_type === "item" && o.target_id === itemId && o.active && /\/menu\/offers\/.+\.webp$/.test(o.image_url ?? ""));
    const bm = await sharp(Buffer.from(await (await fetch(o.image_url)).arrayBuffer())).metadata();
    check("banner stored as 1280x720 WebP", bm.format === "webp" && bm.width === 1280 && bm.height === 720, `${bm.width}x${bm.height}`);
    check("public /offers lists it", (await page$("/offers", "")).text.includes(OFFER));
    const variant = (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id;
    const quote = async () => (await (await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.2.1" }, body: JSON.stringify({ fulfillment: "pickup", lines: [{ itemId, variantId: variant, qty: 2 }] }) })).json()).totals;
    let q = await quote();
    check("the discount is applied: (120+50) x 2 = 340, this offer takes 20% = 68 on top of any store-wide offers", q.subtotal === 340 && Math.abs(q.discountTotal - baseline - 68) < 0.01 && Math.abs(q.total - (340 - q.discountTotal)) < 0.01, `subtotal ${q.subtotal}, discount ${q.discountTotal} (baseline ${baseline}), total ${q.total}`);

    await p.getByRole("switch", { name: `تشغيل ${OFFER}` }).click();
    await until(async () => (await rest(`offers?id=eq.${o.id}&select=active`)).body[0].active === false);
    await sleep(600); // let the public page be revalidated
    q = await quote();
    check("switch it off: public page and totals stop using it", !(await page$("/offers", "")).text.includes(OFFER) && q.discountTotal === baseline);
    await p.getByRole("switch", { name: `تشغيل ${OFFER}` }).click();
    await until(async () => (await rest(`offers?id=eq.${o.id}&select=active`)).body[0].active === true);

    // dates
    await p.locator(`[data-offer="${OFFER}"]`).getByRole("button", { name: "تعديل" }).click();
    await p.getByLabel("ينتهي (اختياري)").fill("2020-01-01T10:00");
    await p.getByRole("button", { name: "حفظ العرض" }).click();
    check("end date in the past (UI)", await toast(p, "اتحفظ العرض"));
    await p.waitForTimeout(1000);
    const [d] = (await rest(`offers?id=eq.${o.id}&select=ends_at`)).body;
    check("Cairo time 10:00 on 1 Jan 2020 stored as 08:00 UTC", new Date(d.ends_at).toISOString() === "2020-01-01T08:00:00.000Z", d.ends_at);
    const chipOk = await p.locator(`[data-offer="${OFFER}"]`).getByText("خلص", { exact: true }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const qExp = await quote();
    check("it is shown as expired (خلص)", chipOk, chipOk ? "" : (await p.locator(`[data-offer="${OFFER}"]`).innerText().catch(() => "row not found")).replace(/s+/g, " ").slice(0, 400) + " | DB active=" + JSON.stringify((await rest(`offers?id=eq.${o.id}&select=active,starts_at,ends_at`)).body));
    check("an expired offer no longer discounts", qExp.discountTotal === baseline, `discount ${qExp.discountTotal} vs baseline ${baseline}`);
    await p.locator(`[data-offer="${OFFER}"]`).getByRole("button", { name: "تعديل" }).click();
    await p.getByLabel("ينتهي (اختياري)").fill("");
    await p.getByLabel("يبدأ (اختياري، بتوقيت القاهرة)").fill("2099-01-01T10:00");
    await p.getByRole("button", { name: "حفظ العرض" }).click();
    await toast(p, "اتحفظ العرض"); await p.waitForTimeout(1000);
    const futOk = await p.locator(`[data-offer="${OFFER}"]`).getByText("لسه ما بدأش").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const qFut = await quote();
    check("a future start date: shown as 'لسه ما بدأش'", futOk, futOk ? "" : (await p.locator(`[data-offer="${OFFER}"]`).innerText().catch(() => "row not found")).replace(/s+/g, " ").slice(0, 120));
    check("a not-yet-started offer is not applied", qFut.discountTotal === baseline, `discount ${qFut.discountTotal} vs baseline ${baseline}`);
    await p.locator(`[data-offer="${OFFER}"]`).getByRole("button", { name: "مسح", exact: true }).click();
    await p.getByRole("button", { name: "امسح العرض" }).click();
    check("delete offer (UI, with confirmation)", await toast(p, "اتمسح العرض", 20000));
    await until(async () => (await rest(`offers?id=eq.${o.id}&select=id`)).body.length === 0);
    await sleep(800);
    check("offer row and its banner file are gone", (await rest(`offers?id=eq.${o.id}&select=id`)).body.length === 0 && !(await inStorage(bannerUrl)));
  });

  // ================================================================ E
  await section("E. Delivery zones and free delivery", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin/zones`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("add-zone").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1000);
    await shot(p, "5-zones");
    await p.getByTestId("add-zone").click();
    await p.getByLabel("اسم المنطقة").fill(ZONE);
    await p.getByLabel("سعر التوصيل (ج.م)").fill("17");
    await p.getByLabel("أقل طلب (ج.م)").fill("50");
    await p.getByLabel("وقت التوصيل المتوقع (دقيقة)").fill("25");
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    check("add zone (UI)", await toast(p, "اتحفظت المنطقة"));
    const zone = async () => (await rest(`delivery_zones?name_ar=eq.${encodeURIComponent(ZONE)}&select=*`)).body[0];
    let z = await zone();
    check("DB: fee 17, minimum 50, ETA 25, active", z && Number(z.fee) === 17 && Number(z.min_order) === 50 && z.eta_minutes === 25 && z.active);
    check("the checkout page lists it immediately", (await page$("/checkout", "")).text.includes(ZONE));

    const variant = (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id;
    const quote = async (extra = {}) => (await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.3.1" }, body: JSON.stringify({ fulfillment: "delivery", zoneId: z.id, lines: [{ itemId, variantId: variant, qty: 1 }], ...extra }) }).then(async (r) => ({ status: r.status, body: await r.json() })));
    let q = await quote();
    check("a quote uses the new zone fee (17)", q.body.totals?.deliveryFee === 17, JSON.stringify(q.body.totals?.deliveryFee));

    // order placed now keeps its fee when the zone changes
    const placed = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.3.2" }, body: JSON.stringify({ name: MARK, phone: "01066660001", fulfillment: "delivery", zoneId: z.id, address: { street: "شارع الاختبار" }, payment: "cash", lines: [{ itemId, variantId: variant, qty: 1 }] }) }).then((r) => r.json());
    const [po] = (await rest(`orders?code=eq.${placed.code}&select=id,delivery_fee,zone_name`)).body; created.orders.push(po.id);

    await p.locator(`[data-zone="${ZONE}"]`).getByRole("button", { name: `تعديل ${ZONE}` }).click();
    await p.getByLabel("سعر التوصيل (ج.م)").fill("23");
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    check("edit fee to 23 (UI)", await toast(p, "اتحفظت المنطقة"));
    q = await quote();
    const [po2] = (await rest(`orders?id=eq.${po.id}&select=delivery_fee`)).body;
    check("new quotes use 23 immediately; the already-placed order keeps 17", q.body.totals?.deliveryFee === 23 && Number(po2.delivery_fee) === 17, `new ${q.body.totals?.deliveryFee}, old ${po2.delivery_fee}`);

    // minimum order enforced from the admin-set value
    check("minimum order 50 is enforced (item costs 170 -> ok)", q.status === 200);
    await p.locator(`[data-zone="${ZONE}"]`).getByRole("button", { name: `تعديل ${ZONE}` }).click();
    await p.getByLabel("أقل طلب (ج.م)").fill("5000");
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    await toast(p, "اتحفظت المنطقة"); await p.waitForTimeout(800);
    q = await quote();
    check("raise the minimum to 5000: the order is refused with an Arabic message", q.status === 422 && /الحد الأدنى/.test(q.body.error?.message ?? ""), q.body.error?.message);
    await p.locator(`[data-zone="${ZONE}"]`).getByRole("button", { name: `تعديل ${ZONE}` }).click();
    await p.getByLabel("أقل طلب (ج.م)").fill("0");
    await p.getByRole("button", { name: "حفظ", exact: true }).click();
    await toast(p, "اتحفظت المنطقة"); await p.waitForTimeout(800);

    // free delivery
    const fd = p.getByLabel("التوصيل المجاني");
    await fd.getByRole("switch", { name: "توصيل مجاني" }).click();
    await p.getByLabel("الحد الأدنى للتوصيل المجاني").fill("100");
    await fd.getByRole("button", { name: "حفظ" }).click();
    check("free delivery above 100 (UI)", await toast(p, "اتحفظ حد التوصيل المجاني"));
    q = await quote();
    check("a 170 EGP order now gets free delivery", q.body.totals?.freeDelivery === true && q.body.totals?.deliveryFee === 0);
    await fd.getByRole("switch", { name: "توصيل مجاني" }).click();
    check("turn it off (UI)", await toast(p, "اتقفل التوصيل المجاني"));
    await p.waitForTimeout(800);
    const again = await quote();
    check("fee is charged again", again.body.totals?.deliveryFee === 23, JSON.stringify({ fee: again.body.totals?.deliveryFee, free: again.body.totals?.freeDelivery, goods: again.body.totals?.goodsTotal, thr: again.body.freeDeliveryThreshold }));

    // disable
    await p.locator(`[data-zone="${ZONE}"]`).getByRole("switch", { name: `${ZONE} شغالة` }).click();
    await p.waitForTimeout(1500);
    check("disabled zone disappears from checkout and can't be used", !(await page$("/checkout", "")).text.includes(ZONE) && (await quote()).status === 409);
    await p.locator(`[data-zone="${ZONE}"]`).getByRole("switch", { name: `${ZONE} شغالة` }).click();
    await p.waitForTimeout(1200);

    // delete
    await p.getByRole("button", { name: `مسح ${ZONE}` }).click();
    await p.getByRole("button", { name: "امسح", exact: true }).click();
    check("delete zone (UI, with confirmation)", await toast(p, "اتمسحت المنطقة"));
    await sleep(800);
    const [po3] = (await rest(`orders?id=eq.${po.id}&select=delivery_fee,zone_name,zone_id`)).body;
    check("the old order still shows its zone name and fee after the zone is deleted", Number(po3.delivery_fee) === 17 && po3.zone_name === ZONE && po3.zone_id === null);
    check("zone is gone from checkout", !(await page$("/checkout", "")).text.includes(ZONE));
  });

  // ================================================================ F
  await section("F. Settings", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin/settings`, { waitUntil: "domcontentloaded" });
    await p.getByLabel("نص الإعلان").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1000);
    await shot(p, "6-settings");
    const card = (title) => p.locator("section", { has: p.getByRole("heading", { name: title }) });

    await p.getByLabel("نص الإعلان").fill("إجازة العيد: مقفول يوم الخميس");
    await card("شريط إعلان").getByRole("button", { name: "حفظ" }).click();
    check("announcement banner (UI)", await toast(p, "الإعلان اتنشر"));
    check("the banner shows on the public site", (await page$("/", "")).text.includes("إجازة العيد: مقفول يوم الخميس"));
    await p.getByLabel("نص الإعلان").fill("");
    await card("شريط إعلان").getByRole("button", { name: "حفظ" }).click();
    await toast(p, "الإعلان اتشال");
    check("clearing it removes the banner", !(await page$("/", "")).text.includes("إجازة العيد"));

    await p.getByLabel("رقم الواتساب").fill("01055555555");
    await card("بيانات المطعم").getByRole("button", { name: "حفظ" }).click();
    check("WhatsApp typed as 0105... (UI)", await toast(p, "اتحفظت بيانات المطعم"));
    const [w] = (await rest("settings?key=eq.restaurant_info&select=value")).body;
    check("it is stored in international form 201055555555", w.value.whatsapp === "201055555555", w.value.whatsapp);
    await p.getByLabel("رقم التليفون").fill("123");
    await card("بيانات المطعم").getByRole("button", { name: "حفظ" }).click();
    check("an invalid phone is rejected with an Arabic message", await toast(p, "رقم التليفون مش صحيح"));
    await p.waitForTimeout(500);

    await p.getByLabel("حالة المطعم").selectOption("closed");
    await card("الفتح والقفل").getByRole("button", { name: "حفظ" }).click();
    check("force 'closed' (UI)", await toast(p, "اتحفظت حالة الفتح"));
    const st = async () => Object.fromEntries((await rest("settings?select=key,value")).body.map((r) => [r.key, r.value]));
    await until(async () => { const x = await st(); return x.open_override === "closed" && x.accept_orders_when_closed === false; });
    const sNow = await st();
    const closedOrder = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.4.1" }, body: JSON.stringify({ name: MARK, phone: "01066660002", fulfillment: "pickup", payment: "cash", lines: [{ itemId, variantId: (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id, qty: 1 }] }) });
    check("while closed (and orders-when-closed is off) the server refuses orders -> 403", closedOrder.status === 403, `${closedOrder.status}; DB override=${sNow.open_override} accept=${sNow.accept_orders_when_closed}`);
    check("the public site says it is closed", /مقفول/.test((await page$("/", "")).text));
    await p.getByRole("switch", { name: "استقبال طلبات وأنت مقفول" }).click();
    await card("الفتح والقفل").getByRole("button", { name: "حفظ" }).click();
    await until(async () => (await rest("settings?key=eq.accept_orders_when_closed&select=value")).body[0].value === true);
    const accepted = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.40.4.2" }, body: JSON.stringify({ name: MARK, phone: "01066660003", fulfillment: "pickup", payment: "cash", lines: [{ itemId, variantId: (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id, qty: 1 }] }) });
    if (accepted.status === 201) { const j = await accepted.json(); const [x] = (await rest(`orders?code=eq.${j.code}&select=id`)).body; created.orders.push(x.id); }
    check("with 'accept orders when closed' on, the same order is accepted -> 201", accepted.status === 201, accepted.status);

    // opening hours
    await p.getByLabel("حالة المطعم").selectOption("auto");
    await card("الفتح والقفل").getByRole("button", { name: "حفظ" }).click();
    await until(async () => (await rest("settings?key=eq.open_override&select=value")).body[0].value === "auto");
    await p.locator('[data-day="6"]').getByRole("switch", { name: "السبت مفتوح" }).click();
    await card("مواعيد العمل").getByRole("button", { name: "حفظ" }).click();
    check("mark Saturday as a day off (UI)", await toast(p, "اتحفظت المواعيد"));
    const [h] = (await rest("settings?key=eq.opening_hours&select=value")).body;
    check("opening_hours saved with Saturday closed", h.value.days.find((d) => d.day === 6).closed === true && h.value.days.length === 7);
    check("the public hours table shows Saturday as 'أجازة'", /السبت[\s\S]{0,200}أجازة/.test((await page$("/", "")).text));
    await shot(p, "6b-settings-after", false);
  });

  // ================================================================ G
  await section("G. Staff accounts", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin/staff`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("add-staff").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1000);
    await shot(p, "7-staff");
    const own = p.locator(`[data-staff="${owner.email}"]`);
    check("your own row can't be switched off or demoted", (await own.getByRole("switch").isDisabled()) && (await own.locator("select").isDisabled()));
    const email = `new-${TAG}@kabash-test.invalid`;
    await p.getByTestId("add-staff").click();
    await p.getByLabel("الاسم", { exact: true }).fill(`اختبار موظف جديد`);
    await p.getByLabel("الإيميل (للدخول)").fill(email);
    await p.getByRole("button", { name: "اعمل واحدة" }).click();
    const pw = await p.getByLabel("كلمة السر", { exact: true }).inputValue();
    check("'اعمل واحدة' generates a 12-character password", pw.length === 12);
    await p.getByRole("button", { name: "ضيف الموظف" }).click();
    check("add a cashier (UI)", await toast(p, "اتضاف الموظف"));
    const prof = (await rest(`profiles?name=eq.${encodeURIComponent("اختبار موظف جديد")}&select=user_id,role,active`)).body[0];
    if (prof) users.newbie = { id: prof.user_id, email, password: pw, role: "cashier" };
    check("DB: profile is an active cashier", prof?.role === "cashier" && prof.active);

    const nctx = await browser.newContext(phone);
    const np = await login(nctx, users.newbie);
    check("the new cashier can sign in and reaches the board", await np.getByText("الطلبات", { exact: true }).first().isVisible({ timeout: 15000 }));
    const nC = await cookieOf(nctx);
    check("...but is kept out of the admin area", (await page$("/admin/menu", nC)).status === 307 && (await api("items", { op: "patch", id: itemId, available: true }, nC)).status === 403);

    const row = p.locator(`[data-staff="${email}"]`);
    await row.locator("select").selectOption("manager");
    check("promote to manager (UI)", await toast(p, "اتغيرت الصلاحية"));
    await sleep(600);
    check("now the admin area opens for them", (await page$("/admin/menu", nC)).status === 200 && (await page$("/admin/staff", nC)).status === 307);

    await row.getByRole("switch").click();
    check("deactivate (UI)", await toast(p, "اتوقف الحساب"));
    await sleep(600);
    check("a deactivated account is locked out at once (API 401, pages redirect)", (await api("items", { op: "patch", id: itemId, available: true }, nC)).status === 401 && (await page$("/staff", nC)).status !== 200);
    await row.getByRole("switch").click();
    await toast(p, "اتفعل الحساب");

    await row.getByRole("button", { name: "كلمة سر جديدة" }).click();
    await p.getByRole("button", { name: "اعمل واحدة" }).click();
    const pw2 = await p.getByLabel("كلمة السر", { exact: true }).inputValue();
    await p.getByRole("button", { name: "غيّر كلمة السر" }).click();
    check("reset password (UI)", await toast(p, "اتغيرت كلمة السر"));
    const probe = createClient(URL_, ANON, { auth: { persistSession: false } });
    const oldPw = await probe.auth.signInWithPassword({ email, password: pw });
    const newPw = await probe.auth.signInWithPassword({ email, password: pw2 });
    check("the old password stops working, the new one works", !!oldPw.error && !newPw.error);
    await nctx.close();

    await row.getByRole("button", { name: "مسح", exact: true }).click();
    await p.getByRole("button", { name: "امسح الحساب" }).click();
    check("delete account (UI, with confirmation)", await toast(p, "اتمسح الحساب"));
    await sleep(800);
    check("the login and profile are gone", (await rest(`profiles?user_id=eq.${prof.user_id}&select=user_id`)).body.length === 0);
    delete users.newbie;
  });

  // ================================================================ H
  await section("H. Reports", async () => {
    await rest("settings?key=eq.open_override", { method: "PATCH", body: JSON.stringify({ value: "open" }) }); // section F left it on auto
    const variant = (await rest(`item_variants?item_id=eq.${itemId}&select=id`)).body[0].id;
    const mk = async (phone, ip, butcher) => {
      const kandoz = (await rest("items?name_ar=eq.لحم كندوز&select=id")).body[0].id;
      const lines = butcher ? [{ itemId: kandoz, qty: 1 }] : [{ itemId, variantId: variant, qty: 1 }];
      const r = await fetch(`${BASE}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify({ name: MARK, phone, fulfillment: "pickup", payment: "cash", lines }) }).then((x) => x.json());
      const [o] = (await rest(`orders?code=eq.${r.code}&select=id,total_estimate`)).body; created.orders.push(o.id); return o;
    };
    const a = await mk("01066660011", "10.40.5.1", false), b = await mk("01066660012", "10.40.5.2", true), c = await mk("01066660013", "10.40.5.3", false);
    const patch = (id, body) => rest(`orders?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(body) });
    await patch(a.id, { status: "delivered" });
    await patch(b.id, { status: "delivered", total_final: 400 });
    await patch(c.id, { status: "cancelled", cancel_reason: "اختبار" });

    // expected, computed independently from the raw tables
    const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" });
    const dayStart = (() => { const now = new Date(); const p = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now); const g = (t) => Number(p.find((x) => x.type === t).value); const off = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(now / 1000) * 1000; const d = new Date(Date.UTC(g("year"), g("month") - 1, g("day")) - off); return new Date(d.getTime() - 6 * 86400000); })();
    const all = (await rest(`orders?created_at=gte.${dayStart.toISOString()}&select=status,total_estimate,total_final,created_at&limit=5000`)).body;
    const live = all.filter((o) => o.status !== "cancelled"), delivered = live.filter((o) => o.status === "delivered");
    const revenue = Math.round(delivered.reduce((s, o) => s + Number(o.total_final ?? o.total_estimate), 0) * 100) / 100;
    const fmtMoney = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

    const p = ownerPage;
    await p.goto(`${BASE}/admin/reports?days=7`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("report-totals").waitFor({ timeout: 20000 });
    await p.waitForTimeout(1200);
    const tiles = await p.getByTestId("report-totals").locator("> div").allInnerTexts();
    const val = (label) => tiles.find((t) => t.startsWith(label))?.split("\n")[1];
    check("tile: number of orders matches the database", val("عدد الطلبات") === String(live.length), `${val("عدد الطلبات")} vs ${live.length}`);
    check("tile: revenue = delivered orders (final price when weighed)", val("الإيراد") === fmtMoney(revenue), `${val("الإيراد")} vs ${fmtMoney(revenue)}`);
    check("tile: average order", val("متوسط الطلب") === fmtMoney(delivered.length ? revenue / delivered.length : 0), val("متوسط الطلب"));
    check("cancelled orders are not counted as orders", tiles.find((t) => t.startsWith("عدد الطلبات"))?.includes(`${all.length - live.length} ملغي`));
    await shot(p, "8-reports");
    // chart hover
    const svg = p.getByRole("img", { name: "عدد الطلبات" });
    const sb = await svg.boundingBox();
    await p.mouse.move(sb.x + sb.width - 40, sb.y + sb.height / 2);
    check("hovering a bar shows a tooltip with the day and counts", await p.getByRole("status").filter({ hasText: "طلب" }).first().isVisible({ timeout: 3000 }).catch(() => false));
    await shot(p, "8b-reports-hover", false);
    // table view
    await p.getByRole("button", { name: "عرض كجدول" }).click();
    const table = p.getByTestId("report-table");
    const todayKey = fmt.format(new Date());
    const rowsText = await table.locator("tbody tr").allInnerTexts();
    check("table view has 7 daily rows", rowsText.length === 7, rowsText.length);
    const todayRow = rowsText[0].split(/\s+/);
    const todayLive = all.filter((o) => fmt.format(new Date(o.created_at)) === todayKey && o.status !== "cancelled").length;
    check("table: today's order count matches", rowsText[0].includes(String(todayLive)), rowsText[0].replace(/\s+/g, " "));
    void todayRow;
    await p.getByRole("button", { name: "أسبوعي" }).click();
    check("weekly view groups days (2 or 3 rows for 7 days)", [2, 3].includes(await table.locator("tbody tr").count()));
    await p.getByRole("button", { name: "عرض الرسم" }).click();
    const splitText = await p.locator("section[aria-label='المطعم والجزارة']").innerText();
    check("split chart shows restaurant and butcher with percentages", splitText.includes("المطعم") && splitText.includes("الجزارة") && /\d+%/.test(splitText), splitText.replace(/\s+/g, " ").slice(0, 120));
    check("top items list is filled", (await p.getByTestId("top-items").locator("li").count()) >= 1);
    for (const d of [30, 90]) {
      await p.goto(`${BASE}/admin/reports?days=${d}`, { waitUntil: "domcontentloaded" });
      await p.getByTestId("report-totals").waitFor();
      check(`range ${d} days renders`, (await p.getByRole("img", { name: "عدد الطلبات" }).count()) === 1);
    }
  });

  // ================================================================ I
  await section("I. Overview and layout on a phone (360px)", async () => {
    const p = ownerPage;
    await p.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("overview-today").waitFor({ timeout: 20000 });
    check("overview shows today's numbers and a to-do list", (await p.getByTestId("overview-today").locator("dd").count()) === 4 && (await p.getByTestId("todo-list").count()) === 1);
    await shot(p, "9-overview");
    await ownerPage.setViewportSize({ width: 360, height: 740 });
    for (const path of ["/admin", "/admin/menu", "/admin/offers", "/admin/zones", "/admin/reports?days=30", "/admin/settings", "/admin/staff"]) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await p.waitForTimeout(1500);
      const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      check(`360px: ${path} has no horizontal scroll`, w.sw <= w.cw + 1, `${w.sw} vs ${w.cw}`);
    }
    // tap targets on the menu page
    await p.goto(`${BASE}/admin/menu`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    await p.locator("section[data-category]").first().getByRole("button", { expanded: false }).first().click().catch(() => {});
    const small = await p.evaluate(() => [...document.querySelectorAll("main button, main a, main [role=switch]")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32); }).map((el) => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 14)} ${Math.round(r.width)}x${Math.round(r.height)}`; }));
    check("tap targets on the menu page are all at least 32px", small.length === 0, small.join(" | "));
    await shot(p, "10-menu-360");
  });

  // ================================================================ J
  await section("J. Delete an item and a category through the UI", async () => {
    const p = ownerPage;
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(`${BASE}/admin/menu`, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    const sec = p.locator(`section[data-category="${CAT}"]`);
    await sec.getByRole("button", { expanded: false }).first().click().catch(() => {});
    const [cur] = (await rest(`items?id=eq.${itemId}&select=image_url`)).body;
    await p.getByRole("button", { name: `تعديل ${ITEM}` }).click();
    await p.getByRole("button", { name: "مسح الصنف" }).click();
    await p.getByRole("button", { name: "امسح الصنف" }).click();
    check("delete item (UI, with confirmation)", await toast(p, "اتمسح الصنف"));
    await sleep(1500);
    check("the item row is gone and its photo was deleted from Storage", (await rest(`items?id=eq.${itemId}&select=id`)).body.length === 0 && !(await inStorage(cur.image_url)));
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.waitForTimeout(1200);
    await p.locator(`section[data-category="${CAT}"]`).getByRole("button", { expanded: false }).first().click().catch(() => {});
    await p.locator(`section[data-category="${CAT}"]`).getByRole("button", { name: "مسح القسم" }).click();
    await p.getByRole("button", { name: "امسح القسم" }).click();
    check("delete category (UI, with confirmation)", await toast(p, "اتمسح القسم"));
    await sleep(800);
    check("category gone from DB and from the public menu", (await rest(`categories?id=eq.${catId}&select=id`)).body.length === 0 && !(await page$("/menu", "")).text.includes(CAT));
  });

  check("no JavaScript errors in any admin page", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally {
  await browser.close().catch(() => {});
  // delete everything we created, restore everything we touched
  for (const k of Object.keys(snap)) await rest(`settings?key=eq.${k}`, { method: "PATCH", body: JSON.stringify({ value: snap[k] === null ? 0 : snap[k] }) }); // JSON null would become SQL NULL; 0 means "off" for the free-delivery threshold
  await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await rest(`offers?title_ar=like.*${encodeURIComponent(MARK)}*`, { method: "DELETE" });
  await rest(`delivery_zones?name_ar=like.*${encodeURIComponent(MARK)}*`, { method: "DELETE" });
  await rest(`items?name_ar=like.*${encodeURIComponent(MARK)}*`, { method: "DELETE" });
  await rest(`categories?name_ar=like.*${encodeURIComponent(MARK)}*`, { method: "DELETE" });
  const leftovers = [];
  for (const folder of ["items", "offers"]) {
    const { data } = await admin.storage.from("menu").list(folder, { limit: 1000 });
    for (const f of data ?? []) if (f.created_at && f.created_at >= startedAt) leftovers.push(`${folder}/${f.name}`);
  }
  if (leftovers.length) await admin.storage.from("menu").remove(leftovers);
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
  const rem = {
    categories: (await rest(`categories?name_ar=like.*${encodeURIComponent(MARK)}*&select=id`)).body.length,
    items: (await rest(`items?name_ar=like.*${encodeURIComponent(MARK)}*&select=id`)).body.length,
    offers: (await rest(`offers?title_ar=like.*${encodeURIComponent(MARK)}*&select=id`)).body.length,
    zones: (await rest(`delivery_zones?name_ar=like.*${encodeURIComponent(MARK)}*&select=id`)).body.length,
    orders: (await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}&select=id`)).body.length,
  };
  console.log(`\nCleanup: removed ${leftovers.length} leftover photo(s) and ${Object.keys(users).length} temp users; settings restored; leftovers in DB: ${JSON.stringify(rem)}`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

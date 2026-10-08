// Staff side end-to-end test in real Chrome: gate, login, live board + alarm, slip, RLS, actions, push storage.
//   node --env-file=.env.local scripts/e2e-staff.mjs [baseUrl] [screenshotDir]
// Creates temporary staff users and tagged orders, then deletes everything it made.
// Sections marked [0003] need supabase/migrations/0003_push_subscriptions.sql to be applied; they are skipped otherwise.
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createECDH } from "node:crypto";

import { forceOpen } from "./_open.mjs";
const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MARK = "اختبار آلي";
const TAG = randomBytes(3).toString("hex");

const rest = (path, { key = SVC, ...init } = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers } })
    .then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
const call = (method, path, body, { ip = "10.20.0.1", cookie } = {}) =>
  fetch(`${BASE}${path}`, { method, redirect: "manual", headers: { "Content-Type": "application/json", "x-forwarded-for": ip, ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json().catch(() => null) }));
const resetLimits = () => rest("rate_limits?key=neq.__none__", { method: "DELETE" });
const admin = createClient(URL_, SVC, { auth: { persistSession: false } });

let pass = 0, failed = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== "" ? `  [${detail}]` : ""}`); };
const skip = (name, why) => console.log(`SKIP  ${name}  [${why}]`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- setup ----------
const hasAck = (await rest("orders?select=acknowledged_by&limit=1")).status === 200;
const hasPush = (await rest("push_subscriptions?select=id&limit=1")).status === 200;
const MIG = hasAck && hasPush;
const restoreOpen = await forceOpen(rest); // work at any time of day
console.log(`migration 0003 applied: ack column=${hasAck}, push table=${hasPush}\n`);

const items = (await rest("items?select=id,name_ar,item_variants(id,name_ar),item_extras(id,name_ar)", { key: ANON })).body;
const zones = (await rest("delivery_zones?select=id&order=sort", { key: ANON })).body;
const mandi = items.find((i) => i.name_ar === "مندي لحم"), kandoz = items.find((i) => i.name_ar === "لحم كندوز");
const large = mandi.item_variants.find((v) => v.name_ar === "كبير"), yog = mandi.item_extras.find((e) => e.name_ar === "سلطة زبادي");

let n = 0;
async function newOrder({ butcher = false, ip = "10.20.9.1", fulfillment = "delivery" } = {}) {
  n++;
  const lines = butcher ? [{ itemId: mandi.id, variantId: large.id, extraIds: [yog.id], qty: 1 }, { itemId: kandoz.id, qty: 1.5 }] : [{ itemId: mandi.id, variantId: large.id, extraIds: [yog.id], qty: 1 }];
  const r = await call("POST", "/api/orders", { name: MARK, phone: `010${String(80000000 + (parseInt(TAG, 16) % 100000) * 100 + n).padStart(8, "0")}`, fulfillment, zoneId: fulfillment === "delivery" ? zones[1].id : null, address: { street: "شارع الاختبار", building: "3", landmark: "x" }, notes: "اختبار", payment: "cash", lines }, { ip });
  if (r.status !== 201) throw new Error(`order failed ${r.status} ${JSON.stringify(r.body)}`);
  const [o] = (await rest(`orders?code=eq.${r.body.code}&select=*`)).body;
  return o;
}

const users = [];
async function mkUser(label, { role = "cashier", active = true, profile = true } = {}) {
  const email = `e2e-${label}-${TAG}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  if (profile) await admin.from("profiles").insert({ user_id: data.user.id, name: `اختبار ${label}`, role, active });
  const u = { id: data.user.id, email, password, label };
  users.push(u);
  return u;
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const newCtx = (extra = {}) => browser.newContext({ viewport: { width: 414, height: 900 }, locale: "ar-EG", ...extra });
async function login(page, u) {
  await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click("button[type=submit]");
}
const orderIds = [];

try {
  await resetLimits();

  // ---------- A. the gate ----------
  console.log("== A. Signed-out access ==");
  for (const p of ["/staff", "/staff/orders/00000000-0000-4000-8000-000000000000/slip"]) {
    const r = await call("GET", p);
    check(`GET ${p.slice(0, 22)}… redirects to login`, [302, 303, 307, 308].includes(r.status) && /\/staff\/login/.test(r.headers.get("location") ?? ""), `${r.status} -> ${r.headers.get("location")}`);
  }
  check("/staff/login is reachable", (await call("GET", "/staff/login")).status === 200);
  const uid = "00000000-0000-4000-8000-000000000000";
  for (const [m, p, b] of [["POST", `/api/staff/orders/${uid}/status`, { status: "accepted" }], ["POST", `/api/staff/orders/${uid}/ack`], ["POST", `/api/staff/orders/${uid}/weigh`, { lines: [] }], ["POST", "/api/staff/push/subscribe", {}], ["POST", "/api/staff/push/unsubscribe", {}], ["POST", "/api/staff/push/test"], ["GET", "/api/staff/summary"]]) {
    const r = await call(m, p, b);
    check(`${m} ${p.replace(uid, ":id")} -> 401 when signed out`, r.status === 401, r.status);
  }

  // ---------- B. accounts ----------
  console.log("\n== B. Login and accounts ==");
  const cashier = await mkUser("cashier", { role: "cashier" });
  const noProfile = await mkUser("noprofile", { profile: false });
  const inactive = await mkUser("inactive", { active: false });

  const c1 = await newCtx(); const p1 = await c1.newPage();
  await login(p1, { ...cashier, password: "wrong-password" });
  check("wrong password -> Arabic error, stays on login", await p1.getByText("الإيميل أو كلمة السر غلط").waitFor({ timeout: 10000 }).then(() => true).catch(() => false) && p1.url().includes("/staff/login"));
  await c1.close();

  for (const u of [noProfile, inactive]) {
    const c = await newCtx(); const p = await c.newPage();
    await login(p, u);
    await p.waitForTimeout(2500);
    await p.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
    check(`${u.label}: valid login but no active staff profile -> kept out of the board`, p.url().includes("/staff/login") && (await p.getByText("مش متفعل كموظف").isVisible().catch(() => false)), p.url());
    await c.close();
  }

  const ctx = await newCtx({ permissions: ["notifications"] });
  const page = await ctx.newPage();
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push(e.message));
  await login(page, cashier);
  await page.waitForURL((u) => /^\/(staff|admin)\/?$/.test(u.pathname), { timeout: 20000 }); // cashier -> /staff, owner/manager -> /admin
  check("cashier signs in and reaches the board", await page.getByText("الطلبات", { exact: true }).first().isVisible({ timeout: 15000 }));
  check("realtime connects ('مباشر')", await page.locator("[data-testid=live][data-live=true]").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  check("sound button shown until tapped", await page.getByTestId("enable-sound").isVisible());
  await page.screenshot({ path: `${SHOTS}/staff-1-empty.png` });

  // ---------- C. live arrival + alarm ----------
  console.log("\n== C. A new order arrives live ==");
  await page.evaluate(() => { window.__noReload = "same page"; });
  await page.getByTestId("enable-sound").click();
  await page.waitForFunction(() => window.__kabashAlarm?.enabled === true, null, { timeout: 5000 });
  check("tap 'تفعيل الصوت' unlocks audio", true);
  check("button becomes 'الصوت شغال'", await page.getByText("الصوت شغال").isVisible());
  // Real customer orders may already be waiting (e.g. from phone testing). Never touch them; count relative to them.
  const base = (await rest("orders?status=eq.new&acknowledged_at=is.null&select=id")).body.length;
  console.log(`  (${base} real unacknowledged order(s) already in the database; the test works relative to that)`);
  const idle = await page.evaluate(() => window.__kabashAlarm.ringing);
  check(base === 0 ? "no alarm while there are no new orders" : "alarm already rings for the order that was waiting before the test", idle === (base > 0));

  const t0 = Date.now();
  const o1 = await newOrder({ butcher: true }); orderIds.push(o1.id);
  const card = page.locator(`[data-order-code="${o1.code}"]`);
  const appeared = await card.waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
  check("the new order's card appears on its own (no reload)", appeared, `${Date.now() - t0} ms`);
  check("alarm banner shows", await page.getByTestId("alarm-banner").isVisible().catch(() => false));
  await page.waitForFunction(() => window.__kabashAlarm?.ringing === true, null, { timeout: 5000 }).catch(() => {});
  const plays1 = await page.evaluate(() => window.__kabashAlarm.plays);
  await page.waitForTimeout(6000);
  const plays2 = await page.evaluate(() => window.__kabashAlarm.plays);
  check("alarm is ringing and REPEATS while unacknowledged", (await page.evaluate(() => window.__kabashAlarm.ringing)) && plays2 - plays1 >= 2, `${plays2 - plays1} chimes in 6s`);
  check("page title shows the new-order count", (await page.title()).startsWith(`(${base + 1})`), await page.title());
  check("card shows items, variant, extras, address, phone and butcher estimate", await Promise.all([card.getByText("مندي لحم").isVisible(), card.getByText("كبير").isVisible(), card.getByText("سلطة زبادي").isVisible(), card.getByText("لحم كندوز").isVisible(), card.getByText("لسه متوزنش").isVisible(), card.getByText("شارع الاختبار").isVisible(), card.locator("a[href^='tel:']").isVisible()]).then((a) => a.every(Boolean)));
  check("tap-to-call and WhatsApp links are correct", (await card.locator("a[href^='tel:']").getAttribute("href")) === `tel:${o1.phone}` && (await card.locator("a[href^='https://wa.me/20']").getAttribute("href")).startsWith(`https://wa.me/20${o1.phone.slice(1)}`));
  await page.screenshot({ path: `${SHOTS}/staff-2-new-order.png`, fullPage: true });

  // a second order while the first is still unacknowledged
  const o2 = await newOrder({ ip: "10.20.9.2" }); orderIds.push(o2.id);
  check("a second order also arrives live; banner says 2", await page.locator(`[data-order-code="${o2.code}"]`).waitFor({ timeout: 12000 }).then(() => true).catch(() => false) && await page.getByText(`في ${base + 2} طلبات جديدة`).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  check("never reloaded", (await page.evaluate(() => window.__noReload)) === "same page");

  // ---------- D. slip ----------
  console.log("\n== D. Print slip ==");
  const sp = await ctx.newPage();
  for (const w of [58, 80]) {
    await sp.goto(`${BASE}/staff/orders/${o1.id}/slip?w=${w}`, { waitUntil: "domcontentloaded" });
    await sp.emulateMedia({ media: "print" });
    const html = await sp.content();
    await sp.locator(".slip").waitFor();
    const box = await sp.locator(".slip").boundingBox();
    const expectPx = (w * 96) / 25.4;
    check(`${w}mm slip: @page size and rendered width`, html.includes(`size: ${w}mm auto`) && Math.abs(box.width - expectPx) < 8, `${Math.round(box.width)}px vs ${Math.round(expectPx)}px`);
    check(`${w}mm slip: toolbar is hidden when printing`, !(await sp.locator(".no-print").first().isVisible()));
    if (w === 80) {
      const text = await sp.locator(".slip").innerText();
      check("slip has code, customer, phone, items, estimate wording and cash", [o1.code, MARK, o1.phone, "مندي لحم", "لحم كندوز", "تقديري", "كاش"].every((s) => text.includes(s)));
      await sp.screenshot({ path: `${SHOTS}/staff-3-slip80.png`, fullPage: true });
    }
  }
  const pdf = await sp.pdf({ preferCSSPageSize: true, printBackground: true });
  check("slip prints to a PDF", pdf.length > 1500 && pdf.subarray(0, 4).toString() === "%PDF", `${pdf.length} bytes`);
  await sp.close();

  // ---------- E. database security as a signed-in cashier ----------
  console.log("\n== E. Row Level Security (cashier session) ==");
  const me = createClient(URL_, ANON, { auth: { persistSession: false } });
  await me.auth.signInWithPassword({ email: cashier.email, password: cashier.password });
  const read = await me.from("orders").select("id, phone").eq("id", o1.id);
  check("cashier can read orders (incl. phone)", read.data?.length === 1);
  const ownProfile = await me.from("profiles").select("user_id");
  check("cashier sees only their own profile row", ownProfile.data?.length === 1 && ownProfile.data[0].user_id === cashier.id);
  const edit = await me.from("items").update({ base_price: 1 }).eq("id", mandi.id).select();
  check("cashier cannot change menu prices", (edit.data ?? []).length === 0);
  const zone = await me.from("delivery_zones").update({ fee: 0 }).eq("id", zones[0].id).select();
  check("cashier cannot edit delivery zones", (zone.data ?? []).length === 0);
  const set = await me.from("settings").update({ value: "closed" }).eq("key", "open_override").select();
  check("cashier cannot change settings", (set.data ?? []).length === 0);
  const mk = await me.from("profiles").insert({ user_id: noProfile.id, name: "x", role: "owner" });
  check("cashier cannot create an owner", !!mk.error);
  const [price] = (await rest(`items?id=eq.${mandi.id}&select=base_price`)).body;
  check("menu price unchanged", Number(price.base_price) === 250, price.base_price);
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  check("anonymous cannot read orders", ((await anon.from("orders").select("id")).data ?? []).length === 0);

  // ---------- F. actions [0003] ----------
  console.log("\n== F. Working the order board ==");
  if (!MIG) {
    skip("mute, accept, weigh, deliver, cancel, race, summary", "apply migration 0003 first");
  } else {
    // mute
    await card.getByRole("button", { name: "كتم الصوت" }).click();
    let a1;
    for (let i = 0; i < 25; i++) { // wait for the acknowledge request to land
      [a1] = (await rest(`orders?id=eq.${o1.id}&select=acknowledged_at,acknowledged_by,status`)).body;
      if (a1.acknowledged_at) break;
      await sleep(200);
    }
    check("mute: order acknowledged by this cashier, status unchanged", !!a1.acknowledged_at && a1.acknowledged_by === cashier.id && a1.status === "new");
    check("alarm keeps ringing while another new order is unacknowledged", (await page.evaluate(() => window.__kabashAlarm.ringing)) === true);
    // accept the second order from the UI
    const card2 = page.locator(`[data-order-code="${o2.code}"]`);
    await card2.getByRole("button", { name: "قبول الطلب" }).click();
    await page.waitForFunction((b) => b > 0 || window.__kabashAlarm?.ringing === false, base, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);
    check(base === 0 ? "accepting the last new order stops the alarm" : "accepting our test order leaves the alarm on for the real waiting order", (await page.evaluate(() => window.__kabashAlarm.ringing)) === (base > 0));
    const [b2] = (await rest(`orders?id=eq.${o2.id}&select=status,acknowledged_at`)).body;
    const ev2 = (await rest(`order_events?order_id=eq.${o2.id}&select=status,by_user&order=created_at`)).body;
    check("accepted in DB, with an event recording WHO did it", b2.status === "accepted" && ev2.at(-1).status === "accepted" && ev2.at(-1).by_user === cashier.id);
    await page.screenshot({ path: `${SHOTS}/staff-4-after-accept.png`, fullPage: true });

    // transitions via API using the browser's session cookie
    const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const st = (id, status, reason, ip = "10.20.7.1") => call("POST", `/api/staff/orders/${id}/status`, { status, reason }, { cookie, ip });
    check("cannot move an order backwards -> 409", (await st(o2.id, "accepted")).status === 409);
    check("cancel without a reason -> 400", (await st(o2.id, "cancelled")).status === 400);
    const racers = await Promise.all([st(o2.id, "preparing"), st(o2.id, "preparing")]);
    check("two phones tap the same button at once: exactly one wins", racers.filter((r) => r.status === 200).length === 1 && racers.filter((r) => r.status === 409).length === 1, racers.map((r) => r.status).join(","));

    // butcher order: weigh before delivery
    await st(o1.id, "accepted"); await st(o1.id, "preparing");
    const blocked = await st(o1.id, "out_for_delivery");
    check("cannot send out an order with unweighed meat -> 409 needs_weighing", blocked.status === 409 && blocked.body?.error?.code === "needs_weighing", blocked.body?.error?.message);
    await page.locator(`[data-tab=active]`).click();
    const c1b = page.locator(`[data-order-code="${o1.code}"]`);
    await c1b.getByRole("button", { name: "وزّن اللحمة الأول" }).click();
    await page.getByLabel("الوزن (كجم)").fill("1.6");
    await page.screenshot({ path: `${SHOTS}/staff-5-weigh.png` });
    await page.getByRole("button", { name: "حفظ الوزن" }).click();
    await page.waitForFunction((code) => document.querySelector(`[data-order-code="${code}"]`)?.textContent?.includes("الإجمالي النهائي"), o1.code, { timeout: 10000 }).catch(() => {});
    const [w1] = (await rest(`orders?id=eq.${o1.id}&select=total_final,total_estimate,discount_total`)).body;
    const wl = (await rest(`order_items?order_id=eq.${o1.id}&kind=eq.butcher&select=qty_final,line_total_final`)).body[0];
    check("weighing saved: 1.6 kg x 420 = 672 and a final total exists", Number(wl.qty_final) === 1.6 && Number(wl.line_total_final) === 672 && w1.total_final !== null, `final ${w1.total_final} vs est ${w1.total_estimate}`);
    check("board card now shows the final total", await c1b.getByText("الإجمالي النهائي").isVisible());
    const tr = await call("GET", `/api/track/${o1.code}`, null, { ip: "10.20.7.5" });
    check("customer's tracking API reflects the final price", tr.body?.totalFinal === Number(w1.total_final) && tr.body?.lines.some((l) => l.qtyFinal === 1.6));
    check("now it can go out for delivery", (await st(o1.id, "out_for_delivery")).status === 200);
    const sumBefore = (await call("GET", "/api/staff/summary", null, { cookie })).body; // real orders may already count today
    check("delivered", (await st(o1.id, "delivered")).status === 200);
    check("a delivered order can't be changed -> 409", (await st(o1.id, "cancelled", "x")).status === 409);

    // cancel with a reason
    const o3 = await newOrder({ ip: "10.20.9.3" }); orderIds.push(o3.id);
    const cx = await st(o3.id, "cancelled", "الصنف خلص");
    const tr3 = await call("GET", `/api/track/${o3.code}`, null, { ip: "10.20.7.6" });
    check("cancelled with a reason; the customer sees it", cx.status === 200 && tr3.body?.status === "cancelled" && tr3.body?.cancelReason === "الصنف خلص");

    // summary
    const sum = await call("GET", "/api/staff/summary", null, { cookie });
    check("daily summary: counts, revenue = delivered final total, top items", sum.status === 200 && sum.body.delivered === sumBefore.delivered + 1 && Math.abs(sum.body.revenue - sumBefore.revenue - Number(w1.total_final)) < 0.01 && sum.body.topItems.length > 0 && sum.body.cancelled === sumBefore.cancelled + 1, JSON.stringify({ orders: sum.body?.orders, delivered: sum.body?.delivered, revenue: sum.body?.revenue, cancelled: sum.body?.cancelled }));
    await page.locator("[data-tab=summary]").click();
    check("summary tab renders", await page.getByTestId("summary").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
    await page.screenshot({ path: `${SHOTS}/staff-6-summary.png`, fullPage: true });

    // deactivated staff lose access immediately
    await admin.from("profiles").update({ active: false }).eq("user_id", cashier.id);
    check("deactivated staff: API -> 401 straight away", (await call("GET", "/api/staff/summary", null, { cookie })).status === 401);
    const pr = await ctx.newPage(); await pr.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
    check("deactivated staff: board is closed to them", pr.url().includes("/staff/login"));
    await pr.close();
    await admin.from("profiles").update({ active: true }).eq("user_id", cashier.id);
  }

  // ---------- G. push storage [0003] ----------
  console.log("\n== G. Push subscriptions ==");
  if (!MIG) {
    skip("subscribe / dedupe / unsubscribe / scoped delete / test endpoint", "apply migration 0003 first");
  } else {
    const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
    const fake = (id) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${TAG}-${id}`, keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") } });
    const s1 = fake("a");
    check("subscribe stores the device", (await call("POST", "/api/staff/push/subscribe", { subscription: s1, userAgent: "e2e" }, { cookie })).status === 200 && (await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s1.endpoint)}&select=user_id`)).body[0]?.user_id === cashier.id);
    await call("POST", "/api/staff/push/subscribe", { subscription: s1 }, { cookie });
    check("subscribing twice keeps ONE row", (await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s1.endpoint)}&select=id`)).body.length === 1);
    check("non-https endpoint is rejected", (await call("POST", "/api/staff/push/subscribe", { subscription: { ...s1, endpoint: "http://evil.example/x" } }, { cookie })).status === 400);
    const other = await mkUser("other", { role: "manager" });
    const oc = await newCtx(); const op = await oc.newPage(); await login(op, other); await op.waitForURL((u) => /^\/(staff|admin)\/?$/.test(u.pathname), { timeout: 20000 });
    const ocookie = (await oc.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    await call("POST", "/api/staff/push/unsubscribe", { endpoint: s1.endpoint }, { cookie: ocookie });
    check("another staff member cannot remove my device", (await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s1.endpoint)}&select=id`)).body.length === 1);
    const mine = createClient(URL_, ANON, { auth: { persistSession: false } });
    await mine.auth.signInWithPassword({ email: other.email, password: other.password });
    check("RLS: another staff member can't even see my device row", ((await mine.from("push_subscriptions").select("id").eq("endpoint", s1.endpoint)).data ?? []).length === 0);
    const noDev = await call("POST", "/api/staff/push/test", null, { cookie: ocookie, ip: "10.20.6.1" });
    check("test notification with no device registered -> clear message", noDev.status === 409 || noDev.status === 503, `${noDev.status} ${noDev.body?.error?.message}`);
    await call("POST", "/api/staff/push/unsubscribe", { endpoint: s1.endpoint }, { cookie });
    check("unsubscribe removes my device", (await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s1.endpoint)}&select=id`)).body.length === 0);
    await oc.close();

    // real browser subscription (best effort: headless Chrome needs Google's push service)
    const real = await page.evaluate(async (key) => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/staff" });
        await navigator.serviceWorker.ready;
        const b64 = key.replace(/-/g, "+").replace(/_/g, "/");
        const raw = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
        return sub.toJSON();
      } catch (e) { return { error: String(e) }; }
    }, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    if (real.error) skip("real Chrome push subscription + delivery", real.error.slice(0, 90));
    else {
      await page.evaluate(() => { window.__pushMsgs = 0; navigator.serviceWorker.addEventListener("message", (e) => e.data?.type === "push" && window.__pushMsgs++); });
      await call("POST", "/api/staff/push/subscribe", { subscription: real, userAgent: "headless chrome" }, { cookie });
      const t = await call("POST", "/api/staff/push/test", null, { cookie, ip: "10.20.6.2" });
      check("real push through Google's service reaches the browser's service worker", t.status === 200 && (await page.waitForFunction(() => window.__pushMsgs > 0, null, { timeout: 15000 }).then(() => true).catch(() => false)), `${t.status} ${t.body?.error?.message ?? ""}`);
      await call("POST", "/api/staff/push/unsubscribe", { endpoint: real.endpoint }, { cookie });
    }
  }
  check("no JavaScript errors on the board", jsErrors.length === 0, jsErrors.slice(0, 2).join(" | "));
} finally {
  await browser.close().catch(() => {});
  const del = await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await restoreOpen();
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
  await resetLimits();
  console.log(`\nCleanup: deleted ${del.body?.length ?? 0} test orders and ${users.length} temporary users (their profiles and push devices cascade).`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

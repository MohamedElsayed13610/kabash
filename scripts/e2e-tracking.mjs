// Tracking page test in a real browser (Chrome via playwright-core). Dev server must be running:
//   node --env-file=.env.local scripts/e2e-tracking.mjs [baseUrl] [screenshotDir]
// Creates tagged orders, changes their status in Supabase like staff would, and checks the page updates
// WITHOUT a reload. Deletes its test orders at the end.
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MARK = "اختبار آلي";
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const rest = (path, { key = SVC, ...init } = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
  }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
const api = (path, body, ip) =>
  fetch(`${BASE}${path}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => ({ status: r.status, text: await r.text() }))
    .then((r) => ({ ...r, body: (() => { try { return JSON.parse(r.text); } catch { return null; } })() }));
const resetLimits = () => rest("rate_limits?key=neq.__none__", { method: "DELETE" });

let pass = 0, failed = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`); };

const get = async (p) => (await rest(p, { key: ANON })).body;
const items = await get("items?select=id,name_ar,item_variants(id,name_ar),item_extras(id,name_ar)");
const zones = await get("delivery_zones?select=id&order=sort");
const mandi = items.find((i) => i.name_ar === "مندي لحم"), kandoz = items.find((i) => i.name_ar === "لحم كندوز");
const large = mandi.item_variants.find((v) => v.name_ar === "كبير"), yog = mandi.item_extras.find((e) => e.name_ar === "سلطة زبادي");

let phoneN = 0;
const PHONE_SECRET = "01099991234", STREET_SECRET = "شارع-سري-للاختبار", NOTE_SECRET = "ملاحظة-سرية";
async function newOrder(fulfillment = "delivery", ip = "10.9.0.1") {
  const body = {
    name: MARK, phone: phoneN++ === 0 ? PHONE_SECRET : `010999900${String(phoneN).padStart(2, "0")}`, fulfillment,
    zoneId: fulfillment === "delivery" ? zones[1].id : null,
    address: { street: STREET_SECRET, building: "7", landmark: "جنب الكوبري" }, notes: NOTE_SECRET, payment: "cash",
    lines: [{ itemId: mandi.id, variantId: large.id, extraIds: [yog.id], qty: 1 }, { itemId: kandoz.id, qty: 1.5 }],
  };
  const r = await api("/api/orders", body, ip);
  if (r.status !== 201) throw new Error(`order failed ${r.status} ${r.text}`);
  const [o] = (await rest(`orders?code=eq.${r.body.code}&select=id,code`)).body;
  return o;
}
async function setStatus(o, status, extra = {}) {
  await rest(`orders?id=eq.${o.id}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
  await rest("order_events", { method: "POST", body: JSON.stringify({ order_id: o.id, status, note: "تغيير من الاختبار" }) });
}

try {
  await resetLimits();

  // ---------- API: safe fields ----------
  console.log("== A. What the tracking endpoint exposes ==");
  const order = await newOrder("delivery");
  const t = await api(`/api/track/${order.code}`, null, "10.9.1.1");
  check("tracking API returns the order", t.status === 200 && t.body?.code === order.code, t.status);
  const keys = Object.keys(t.body ?? {}).sort().join(",");
  console.log("  top-level fields:", keys);
  console.log("  line fields:", Object.keys(t.body.lines[0]).join(","));
  const leak = (what, needle) => check(`response does not contain ${what}`, !t.text.includes(needle));
  leak("the customer's phone", PHONE_SECRET); leak("the customer's name", MARK); leak("the street address", STREET_SECRET);
  leak("the notes", NOTE_SECRET); leak("the order's internal id", order.id);
  check("response contains no UUIDs at all (no item/zone/staff ids)", !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t.text));
  const TOP = "cancelReason,code,createdAt,deliveryFee,discount,etaMinutes,events,fulfillment,hasButcher,lines,status,subtotal,totalEstimate,totalFinal,updatedAt,zoneName";
  const LINE = "extras,lineEstimate,lineFinal,name,qtyFinal,qtyRequested,unit,variant";
  check("top-level keys are exactly the whitelist", keys === TOP);
  check("line keys are exactly the whitelist", Object.keys(t.body.lines[0]).sort().join(",") === LINE);
  check("events carry only status + time (no staff id, no note)", t.body.events.every((e) => Object.keys(e).sort().join(",") === "at,status"));
  check("lowercase code works too", (await api(`/api/track/${order.code.toLowerCase()}`, null, "10.9.1.1")).status === 200);
  check("Cache-Control: no-store", (await fetch(`${BASE}/api/track/${order.code}`)).headers.get("cache-control")?.includes("no-store"));

  console.log("\n== B. Wrong codes and rate limiting ==");
  await resetLimits();
  const bad = await api("/api/track/ABCDEF", null, "10.9.2.1");
  check("unknown code -> 404 with Arabic message", bad.status === 404 && /مفيش طلب/.test(bad.text), bad.status);
  check("malformed code -> 404", (await api("/api/track/%27%3Bdrop", null, "10.9.2.1")).status === 404);
  check("code with ambiguous chars (0, O, 1, I) -> 404", (await api("/api/track/OO0II1", null, "10.9.2.1")).status === 404);
  const guesses = [];
  for (let i = 0; i < 25; i++) guesses.push((await api(`/api/track/${["ABCDEF","ZZZZZZ","234567"][i % 3].replace(/.$/, String(2 + (i % 8)))}`, null, "10.9.2.2")).status);
  check("code guessing: first 20 wrong guesses -> 404, then 429", guesses.slice(0, 20).every((s) => s === 404) && guesses.slice(20).every((s) => s === 429), guesses.join(" "));
  check("a valid code from another IP still works during that", (await api(`/api/track/${order.code}`, null, "10.9.2.3")).status === 200);
  await resetLimits();
  const polls = await Promise.all(Array.from({ length: 640 }, () => api(`/api/track/${order.code}`, null, "10.9.2.4").then((r) => r.status)));
  check("normal polling: 600/min per IP allowed, beyond that 429", polls.filter((s) => s === 200).length === 600 && polls.filter((s) => s === 429).length === 40, `${polls.filter((s) => s === 200).length} ok / ${polls.filter((s) => s === 429).length} limited`);
  await resetLimits();

  // ---------- browser ----------
  console.log("\n== C. Live updates in a real browser (no reload) ==");
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ar-EG", isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().startsWith("Failed to load resource") && errors.push(m.text()));
  let trackCalls = 0;
  page.on("request", (r) => r.url().includes("/api/track/") && trackCalls++);
  const headline = async (status, text, ms = 14000) => {
    try {
      await page.waitForFunction(([st, tx]) => { const el = document.querySelector("[data-testid=headline]"); return el && el.getAttribute("data-status") === st && el.textContent.trim() === tx; }, [status, text], { timeout: ms });
      return true;
    } catch { return false; }
  };
  const see = async (text, ms = 14000) => { try { await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: ms }); return true; } catch { return false; } };
  const shot = async (n, fullPage = false) => { await page.waitForTimeout(1100); await page.screenshot({ path: `${SHOTS}/track-${n}.png`, fullPage }); };

  await page.goto(`${BASE}/order/${order.code}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { window.__noReload = "still here"; });
  check("initial state: 'وصلنا طلبك' + the code", (await headline("new", "وصلنا طلبك", 20000)) && (await page.getByText(order.code).first().isVisible()));
  check("shows the estimate note for butcher items", await see("السعر تقديري"));
  await shot("1-received");

  await setStatus(order, "accepted");
  check("-> accepted: page shows 'الطلب اتأكد'", await headline("accepted", "الطلب اتأكد"));
  await setStatus(order, "preparing");
  check("-> preparing: 'بنجهز أكلك'", await headline("preparing", "بنجهز أكلك"));
  await shot("2-preparing");
  await setStatus(order, "out_for_delivery");
  check("-> out for delivery: 'الطلب في الطريق'", await headline("out_for_delivery", "الطلب في الطريق"));
  await shot("3-on-the-way");

  // staff weighs the butcher item: actual 1.6kg (672) -> final total
  const lines = (await rest(`order_items?order_id=eq.${order.id}&select=id,name_snapshot`)).body;
  const butcherLine = lines.find((l) => l.name_snapshot === "لحم كندوز");
  await rest(`order_items?id=eq.${butcherLine.id}`, { method: "PATCH", body: JSON.stringify({ qty_final: 1.6, line_total_final: 672 }) });
  await rest(`orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify({ total_final: 1490 }) });
  check("butcher weighed: 'الوزن الفعلي' and 'الإجمالي النهائي' appear", (await see("الوزن الفعلي")) && (await see("الإجمالي النهائي")));
  check("  estimate is shown struck through next to the final", (await page.locator("s").count()) >= 1 && (await page.locator("dd.line-through").count()) === 1);
  await shot("4-weighed-final", true);

  await setStatus(order, "delivered");
  check("-> delivered: 'بالهنا والشفا'", await headline("delivered", "بالهنا والشفا"));
  await shot("5-delivered");
  check("page was never reloaded during all of this", (await page.evaluate(() => window.__noReload)) === "still here");
  const before = trackCalls; await page.waitForTimeout(12000);
  check("polling stops once delivered (no requests in 12s)", trackCalls === before, `${trackCalls - before} extra requests`);

  // offline recovery on a fresh order
  console.log("\n== D. Offline / recovery ==");
  const o2 = await newOrder("delivery", "10.9.3.1");
  await page.goto(`${BASE}/order/${o2.code}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => { window.__noReload = "ok"; });
  check("second order loads", await see("وصلنا طلبك", 15000));
  await ctx.setOffline(true);
  check("offline: shows the 'no connection' notice but keeps the last state", (await see("مفيش اتصال", 16000)) && (await page.getByText("وصلنا طلبك").first().isVisible()));
  await setStatus(o2, "preparing");
  await ctx.setOffline(false);
  check("back online: catches up to 'بنجهز أكلك' by itself", await headline("preparing", "بنجهز أكلك", 25000));
  await shot("6-after-offline");

  // cancelled
  console.log("\n== E. Cancelled ==");
  await setStatus(o2, "cancelled", { cancel_reason: "المنطقة خارج نطاق التوصيل النهارده" });
  check("cancelled: 'الطلب اتلغى' + the reason + no timeline", (await headline("cancelled", "الطلب اتلغى")) && (await see("المنطقة خارج نطاق التوصيل")) && (await page.getByRole("list", { name: "مراحل الطلب" }).count()) === 0);
  await shot("7-cancelled", true);
  const cb = trackCalls; await page.waitForTimeout(11000);
  check("polling stops once cancelled", trackCalls === cb, `${trackCalls - cb} extra`);

  // pickup wording
  console.log("\n== F. Pickup wording ==");
  const o3 = await newOrder("pickup", "10.9.4.1");
  await page.goto(`${BASE}/order/${o3.code}`, { waitUntil: "domcontentloaded" });
  await see("وصلنا طلبك", 15000);
  await setStatus(o3, "out_for_delivery");
  check("pickup order shows 'طلبك جاهز' and 'جاهز للاستلام'", (await headline("out_for_delivery", "طلبك جاهز")) && (await see("طلبك جاهز للاستلام")));
  await shot("8-pickup-ready");

  // not found + bad code
  await page.goto(`${BASE}/order/ABCDEF`, { waitUntil: "domcontentloaded" });
  check("unknown code page: 'مش لاقيين الطلب ده'", await see("مش لاقيين الطلب ده", 15000));
  const r404 = await fetch(`${BASE}/order/not-a-code`);
  check("malformed code in the URL -> 404 page", r404.status === 404, r404.status);
  check("no JavaScript errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
} finally {
  const del = await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await resetLimits();
  console.log(`\nCleanup: deleted ${del.body?.length ?? 0} test orders, rate limits cleared.`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

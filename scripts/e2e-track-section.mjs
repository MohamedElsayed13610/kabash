// "تتبع طلبك" section, nav tab, floating chip and recent codes, in real Chrome on phone-sized viewports.
//   node --env-file=.env.local scripts/e2e-track-section.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright-core";

import { forceOpen } from "./_open.mjs";
const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MARK = "اختبار آلي";
const PHONE = "01077770002", STREET = "شارع-خاص-بالاختبار";
const rest = (p, o = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...o, headers: { apikey: o.key ?? SVC, Authorization: `Bearer ${o.key ?? SVC}`, "Content-Type": "application/json", Prefer: "return=representation" } }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
let pass = 0, failed = 0;
const check = (n, ok, d = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? `  [${d}]` : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const setStatus = async (id, status, extra = {}) => {
  await rest(`orders?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status, ...extra }) });
  await rest("order_events", { method: "POST", body: JSON.stringify({ order_id: id, status }) });
};

const items = (await rest("items?select=id,name_ar", { key: ANON })).body;
const restoreOpen = await forceOpen(rest); // work at any time of day
const zones = (await rest("delivery_zones?select=id&order=sort", { key: ANON })).body;
const chicken = items.find((i) => i.name_ar === "مندي دجاج");
await rest("rate_limits?key=neq.__none__", { method: "DELETE" });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const phone = { viewport: { width: 390, height: 844 }, locale: "ar-EG", isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
try {
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let statusCalls = 0;
  page.on("request", (r) => r.url().includes("/api/track-status") && statusCalls++);
  const hydrate = () => page.waitForTimeout(1200);
  const rowText = (code) => page.locator(`[data-track-order="${code}"] [data-testid=order-status]`).innerText();
  const waitRow = (code, text, ms = 20000) => page.waitForFunction(([c, t]) => document.querySelector(`[data-track-order="${c}"] [data-testid=order-status]`)?.textContent?.trim() === t, [code, text], { timeout: ms }).then(() => true).catch(() => false);

  // ---------- 1. placement, empty state, nav ----------
  console.log("== 1. A brand-new visitor ==");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await hydrate();
  const sec = page.getByTestId("track-section");
  check("home has a 'تتبع طلبك' section", await sec.isVisible());
  const pos = await page.evaluate(() => {
    const top = (el) => el?.getBoundingClientRect().top + scrollY;
    const hero = [...document.querySelectorAll("h1")].find((h) => h.textContent.includes("نكهة"));
    const heroSection = hero.closest("section");
    return { heroBottom: heroSection.getBoundingClientRect().bottom + scrollY, track: top(document.querySelector("[data-testid=track-section]")), offers: top([...document.querySelectorAll("h2")].find((h) => h.textContent.includes("عروض"))), dishes: top([...document.querySelectorAll("h2")].find((h) => h.textContent.includes("صواني الكباش"))), vh: innerHeight };
  });
  check("placed right after the hero, above offers and dishes", pos.track >= pos.heroBottom - 1 && pos.track < (Number.isFinite(pos.offers) ? pos.offers : pos.dishes) && pos.track < pos.dishes, JSON.stringify(pos));
  check("empty state text + code field", (await page.getByText("أول ما تطلب هتلاقي طلبك هنا").isVisible()) && (await page.locator("#track-code").isVisible()));
  const tabs = await page.locator("nav[aria-label=التنقل] a").allInnerTexts();
  check("bottom bar has the 'تتبع طلبك' tab (5 tabs)", tabs.length === 5 && tabs.some((t) => t.includes("تتبع طلبك")), tabs.join(" | "));
  await page.screenshot({ path: `${SHOTS}/track-s1-home-empty.png` });
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
  await hydrate();
  check("header has a 'تتبع طلبك' link", await page.locator("header a[href='/track']").isVisible());
  check("no chip and no badge without an order", (await page.getByTestId("active-order-chip").count()) === 0 && (await page.getByTestId("track-badge").count()) === 0);

  // ---------- 2. real checkout ----------
  console.log("\n== 2. Order through the real UI ==");
  await page.getByLabel(`ضيف ${chicken.name_ar} للصينية`).first().click();
  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#name"); await hydrate();
  await page.fill("#name", MARK); await page.fill("#phone", PHONE);
  await page.selectOption("#zoneId", zones[0].id);
  await page.fill("#address-street", STREET);
  await page.getByRole("button", { name: /ابعت الطلب/ }).click();
  await page.waitForURL(/\/order\/[A-Z0-9]{6}/, { timeout: 20000 });
  const code = page.url().split("/order/")[1];
  const [ord] = (await rest(`orders?code=eq.${code}&select=id`)).body;
  check("order placed", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);

  // ---------- 3. live status in the section, badge, chip ----------
  console.log("\n== 3. Live status everywhere ==");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-track-order="${code}"]`, { timeout: 10000 });
  check("section lists the order with its code and a 'تتبع' button", (await page.locator(`[data-track-order="${code}"] a`, { hasText: "تتبع" }).count()) >= 1);
  check("status 'وصلنا طلبك' (live from the server)", await waitRow(code, "وصلنا طلبك", 15000), await rowText(code));
  check("bottom bar shows an 'active order' badge", await page.getByTestId("track-badge").isVisible());
  await page.screenshot({ path: `${SHOTS}/track-s2-home-new.png` });

  const t0 = Date.now();
  await setStatus(ord.id, "preparing");
  check("staff moves it to preparing: the home section updates without reload", await waitRow(code, "طلبك قيد التحضير", 25000), `${Date.now() - t0} ms`);
  check("home: the chip is visible at the top while the section is still below the fold", await page.getByTestId("active-order-chip").waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
  await page.screenshot({ path: `${SHOTS}/track-s3-home-preparing.png` });
  await page.getByTestId("track-section").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 200));
  await page.waitForTimeout(800);
  check("home: the chip hides once the full section is on screen (no duplicate)", (await page.getByTestId("active-order-chip").count()) === 0);
  await page.evaluate(() => scrollTo(0, 0));

  await page.evaluate(() => (window.__nr = 1));
  await page.getByRole("link", { name: "المنيو" }).first().click();
  await page.waitForURL("**/menu");
  await page.getByTestId("active-order-chip").waitFor({ timeout: 10000 });
  const chip = page.getByTestId("active-order-chip");
  check("menu page shows the floating chip 'طلبك قيد التحضير · تتبع'", /طلبك قيد التحضير/.test(await chip.innerText()) && /تتبع/.test(await chip.innerText()), (await chip.innerText()).replace(/\n/g, " "));
  await page.goto(`${BASE}/butcher`, { waitUntil: "domcontentloaded" });
  check("butcher page shows it too", await page.getByTestId("active-order-chip").waitFor({ timeout: 10000 }).then(() => true).catch(() => false));
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" }); await hydrate();
  await page.getByLabel(`ضيف ${chicken.name_ar} للصينية`).first().click();
  await page.waitForTimeout(1200);
  const boxes = await page.evaluate(() => {
    const r = (sel) => document.querySelector(sel)?.getBoundingClientRect();
    const chipEl = document.querySelector("[data-testid=active-order-chip] > div").getBoundingClientRect();
    const cartBtn = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label")?.startsWith("افتح الصينية"))?.getBoundingClientRect();
    return { chipBottom: chipEl.bottom, cartTop: cartBtn?.top, chipTop: chipEl.top };
  });
  check("with items in the cart the chip sits above the cart bar (no overlap)", boxes.cartTop !== undefined && boxes.chipBottom <= boxes.cartTop + 1, JSON.stringify(boxes));
  await page.screenshot({ path: `${SHOTS}/track-s4-menu-chip.png` });
  await page.getByTestId("active-order-chip").locator("a").first().click();
  await page.waitForURL(`**/order/${code}`, { timeout: 10000 });
  check("tapping the chip opens that order's tracking page", await page.getByTestId("headline").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));

  // ---------- 4. privacy ----------
  console.log("\n== 4. What is stored on the device ==");
  const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  const recent = await page.evaluate(() => JSON.parse(localStorage.getItem("kabash.recentOrders.v1")));
  check("recent orders hold only code/time/total/status/type", recent.every((r) => Object.keys(r).every((k) => ["code", "at", "total", "status", "fulfillment"].includes(k))), JSON.stringify(recent[0]));
  const dumpLow = dump;
  check("the phone number is not stored in the recents list", !JSON.stringify(recent).includes(PHONE.slice(2)));
  check("the street is not stored in the recents list", !JSON.stringify(recent).includes(STREET));
  await page.goto(`${BASE}/track`, { waitUntil: "domcontentloaded" }); await hydrate();
  const trackHtml = await page.content();
  check("/track page shows neither phone nor address", !trackHtml.includes(PHONE) && !trackHtml.includes(STREET));
  void dumpLow;

  // ---------- 5. /track page ----------
  console.log("\n== 5. /track page and the end of the order ==");
  check("/track lists the order with live status", await waitRow(code, "طلبك قيد التحضير", 20000));
  await setStatus(ord.id, "out_for_delivery");
  check("-> 'طلبك في الطريق'", await waitRow(code, "طلبك في الطريق", 25000));
  await page.screenshot({ path: `${SHOTS}/track-s5-track-page.png` });
  await setStatus(ord.id, "delivered");
  check("-> delivered: row says 'اتسلم'", await waitRow(code, "اتسلم", 25000));
  check("badge disappears when nothing is active", await page.getByTestId("track-badge").waitFor({ state: "detached", timeout: 5000 }).then(() => true).catch(() => false));
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" }); await hydrate();
  await page.waitForTimeout(1500);
  check("no chip on /menu once delivered", (await page.getByTestId("active-order-chip").count()) === 0);
  const before = statusCalls; await page.waitForTimeout(13000);
  check("a finished order is never polled again (13 s, 0 requests)", statusCalls === before, `${statusCalls - before} requests`);

  // cancelled order: row says 'اتلغى', no chip
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" }); await hydrate();
  await page.getByLabel(`ضيف ${chicken.name_ar} للصينية`).first().click();
  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#name"); await hydrate();
  await page.fill("#name", MARK); await page.fill("#phone", "01077770003"); await page.selectOption("#zoneId", zones[0].id); await page.fill("#address-street", STREET);
  await page.getByRole("button", { name: /ابعت الطلب/ }).click();
  await page.waitForURL(/\/order\/[A-Z0-9]{6}/, { timeout: 20000 });
  const code2 = page.url().split("/order/")[1];
  const [ord2] = (await rest(`orders?code=eq.${code2}&select=id`)).body;
  await setStatus(ord2.id, "cancelled", { cancel_reason: "اختبار" });
  await page.goto(`${BASE}/track`, { waitUntil: "domcontentloaded" });
  check("cancelled order shows 'اتلغى' in the list", await waitRow(code2, "اتلغى", 20000));
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" }); await hydrate();
  check("no chip for a cancelled order", (await page.getByTestId("active-order-chip").count()) === 0);

  // ---------- 6. code entry, other devices ----------
  console.log("\n== 6. Another phone, typing the code ==");
  const ctx2 = await browser.newContext(phone);
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }); await p2.waitForTimeout(1500);
  check("a different device has no recent orders", (await p2.locator("[data-track-order]").count()) === 0);
  const go = p2.getByRole("button", { name: "تابع الطلب" });
  await p2.fill("#track-code", "abc");
  check("code form: invalid code keeps the button disabled", await go.isDisabled());
  await p2.fill("#track-code", code.toLowerCase());
  check("code form: lowercase valid code is accepted", await go.isEnabled());
  await go.click();
  await p2.waitForURL(`**/order/${code}`, { timeout: 10000 });
  check("opens that order's tracking page", await p2.getByTestId("headline").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));
  await ctx2.close();

  // ---------- 7. rate limits on the new lookup ----------
  console.log("\n== 7. Rate limits ==");
  await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
  const call = (codes, ip) => fetch(`${BASE}/api/track-status?codes=${codes}`, { headers: { "x-forwarded-for": ip } }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), text: "" }));
  const rnd = () => Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
  const seq = [];
  for (let i = 0; i < 24; i++) seq.push((await call(rnd(), "10.31.0.1")).status);
  check("guessing codes: first 20 unknown codes answered, then 429", seq.slice(0, 20).every((s) => s === 200) && seq.slice(20).every((s) => s === 429), seq.join(" "));
  check("another IP is unaffected", (await call(code, "10.31.0.2")).status === 200);
  const many = await call([code, code2, rnd(), rnd(), rnd(), rnd(), rnd(), rnd(), rnd()].join(","), "10.31.0.3");
  check("a batch is capped at 5 codes", many.status === 200 && many.body.orders.length + many.body.missing.length <= 5, `${many.body?.orders.length} found + ${many.body?.missing.length} missing`);
  const r = await call(code, "10.31.0.4");
  const keys = Object.keys(r.body.orders[0] ?? {}).sort().join(",");
  check("status endpoint exposes only code, status, type, time", keys === "code,fulfillment,status,updatedAt", keys);
  const polls = await Promise.all(Array.from({ length: 640 }, () => fetch(`${BASE}/api/track-status?codes=${code}`, { headers: { "x-forwarded-for": "10.31.0.5" } }).then((x) => x.status)));
  check("polling cap: 600/min per IP", polls.filter((s) => s === 200).length === 600 && polls.filter((s) => s === 429).length === 40, `${polls.filter((s) => s === 200).length} ok / ${polls.filter((s) => s === 429).length} limited`);

  // ---------- 8. robustness + phone layout ----------
  console.log("\n== 8. Robustness and layout at 360px ==");
  await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
  const c3 = await browser.newContext({ ...phone, viewport: { width: 360, height: 740 } });
  const p3 = await c3.newPage();
  await p3.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p3.evaluate(() => localStorage.setItem("kabash.recentOrders.v1", "{broken"));
  await p3.reload({ waitUntil: "domcontentloaded" }); await p3.waitForTimeout(1500);
  check("corrupted storage is ignored", await p3.getByTestId("track-section").isVisible());
  await p3.evaluate(([c]) => localStorage.setItem("kabash.recentOrders.v1", JSON.stringify([{ code: c, at: Date.now(), total: 106, status: "preparing", fulfillment: "delivery" }, { code: "ZZZZZZ", at: Date.now() - 1000, total: 5 }])), [code]);
  await p3.reload({ waitUntil: "domcontentloaded" }); await p3.waitForTimeout(2500);
  check("an unknown code in storage is dropped after the first lookup", (await p3.locator('[data-track-order="ZZZZZZ"]').count()) === 0);
  for (const path of ["/", "/menu", "/butcher", "/offers", "/track"]) {
    await p3.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" }); await p3.waitForTimeout(1200);
    const w = await p3.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    check(`360px: ${path} has no horizontal scroll`, w.sw <= w.cw + 1, `${w.sw} vs ${w.cw}`);
  }
  await p3.goto(`${BASE}/`, { waitUntil: "domcontentloaded" }); await p3.waitForTimeout(1500);
  await p3.screenshot({ path: `${SHOTS}/track-s6-home-360.png` });
  await c3.close();
  check("no JavaScript errors", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally {
  await browser.close();
  const del = await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await restoreOpen();
  await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
  console.log(`\nCleanup: deleted ${del.body?.length ?? 0} test orders.`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

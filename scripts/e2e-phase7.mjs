// Phase 7 end-to-end: role-based landing, safe return paths, board<->admin links, instant public updates,
// SEO files, error pages, reduced motion, focus rings.
//   node --env-file=.env.local scripts/e2e-phase7.mjs [baseUrl] [screenshotDir]
// Creates temporary staff users (@kabash-test.invalid) and one temporary menu item tagged "اختبار آلي",
// then deletes both. Real data is never modified.
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TAG = randomBytes(3).toString("hex");
const MARK = "اختبار آلي";
const ITEM = `صنف سعر ${MARK}`;

const admin = createClient(URL_, SVC, { auth: { persistSession: false } });
const rest = (p, o = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...o, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation" } }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
let pass = 0, failed = 0;
const check = (n, ok, d = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? `  [${d}]` : ""}`); };
// E2E_ONLY=J runs only the listed sections (A, B, ...)
const ONLY = process.env.E2E_ONLY?.split(",") ?? null;
async function section(name, fn) {
  if (ONLY && !ONLY.includes(name.split(".")[0])) return;
  console.log(`\n== ${name} ==`);
  try { await fn(); } catch (e) { check(`${name}: section crashed`, false, String(e.message).split("\n")[0].slice(0, 160)); }
}
const get = (path, cookie = "") => fetch(`${BASE}${path}`, { redirect: "manual", headers: { cookie } }).then(async (r) => ({ status: r.status, location: r.headers.get("location"), type: r.headers.get("content-type") ?? "", text: await r.text() }));
/** Where a response sends the browser: a Location header, or (inside a streamed page, behind loading.tsx) a refresh meta tag. */
const target = (r) => r.location ?? r.text.match(/<meta[^>]+http-equiv="refresh"[^>]+content="\d+;url=([^"]+)"/)?.[1] ?? null;
const cookieOf = async (ctx) => (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

const users = {};
async function mkUser(label, role) {
  const email = `p7-${label}-${TAG}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  await admin.from("profiles").insert({ user_id: data.user.id, name: `اختبار ${label}`, role, active: true });
  users[label] = { id: data.user.id, email, password, role };
  return users[label];
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const phone = { viewport: { width: 390, height: 844 }, locale: "ar-EG", isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const errors = [];
const fresh = async () => { const ctx = await browser.newContext(phone); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(e.message)); return { ctx, page }; };
/** Fill the one login form and wait until we have left /staff/login for good. Returns the final URL. */
async function signIn(page, u, from = "/staff/login") {
  await page.goto(`${BASE}${from}`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", u.email);
  await page.fill("#password", u.password);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => !/^\/staff\/(login|go)\/?$/.test(url.pathname), { timeout: 30000 });
  await page.waitForLoadState("domcontentloaded");
  return new URL(page.url());
}

let itemId = null;
try {
  const owner = await mkUser("owner", "owner");
  const manager = await mkUser("manager", "manager");
  const cashier = await mkUser("cashier", "cashier");

  // ================================================================ A
  await section("A. One login page, three destinations", async () => {
    for (const [u, want] of [[owner, "/admin"], [manager, "/admin"], [cashier, "/staff"]]) {
      const { ctx, page } = await fresh();
      const at = await signIn(page, u);
      check(`${u.role}: signs in at /staff/login and lands on ${want}`, at.pathname.replace(/\/$/, "") === want, at.pathname);
      await ctx.close();
    }
  });

  // ================================================================ B
  await section("B. Board <-> admin links follow the role", async () => {
    const { ctx, page } = await fresh();
    await signIn(page, manager);
    await page.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
    const link = page.getByTestId("to-admin");
    await link.waitFor({ timeout: 20000 });
    check("manager sees a visible link from the board to /admin", await link.isVisible());
    const box = await link.boundingBox();
    check("...and it is a 44px+ tap target", !!box && box.height >= 44 && box.width >= 44, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : "");
    await page.screenshot({ path: `${SHOTS}/p7-board-manager.png` });
    await link.click();
    await page.waitForURL("**/admin", { timeout: 20000 });
    const back = page.getByTestId("to-board");
    await back.waitFor({ timeout: 20000 });
    check("/admin has a link back to the board", await back.isVisible());
    await back.click();
    await page.waitForURL("**/staff", { timeout: 20000 });
    check("...and it works", /\/staff\/?$/.test(page.url()));
    await ctx.close();

    const c = await fresh();
    await signIn(c.page, cashier);
    await c.page.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
    await c.page.waitForSelector("[data-testid=live]", { timeout: 20000 });
    check("cashier: no /admin link on the board", (await c.page.getByTestId("to-admin").count()) === 0);
    check("cashier: no /admin href anywhere in the board's HTML", !/href="\/admin/.test(await c.page.content()));
    await c.ctx.close();
  });

  // ================================================================ C
  await section("C. Cashier cannot reach the admin area", async () => {
    const { ctx, page } = await fresh();
    await signIn(page, cashier);
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((u) => !/^\/admin/.test(u.pathname), { timeout: 20000 }).catch(() => {});
    check("typing /admin sends the cashier to the board", /\/staff\/?$/.test(new URL(page.url()).pathname), new URL(page.url()).pathname);
    await page.goto(`${BASE}/admin/reports`, { waitUntil: "domcontentloaded" });
    await page.waitForURL((u) => !/^\/admin/.test(u.pathname), { timeout: 20000 }).catch(() => {});
    check("...also for a deep admin page", /\/staff\/?$/.test(new URL(page.url()).pathname), new URL(page.url()).pathname);
    const c = await cookieOf(ctx);
    const r = await get("/admin/menu", c);
    check("server answer is a redirect, not the page", r.status === 307 && /\/staff$/.test(r.location ?? "") && !r.text.includes("إدارة المنيو"), `${r.status} ${r.location}`);
    // signed-in people who open the login page are sent on, not shown the form again
    const l = await get("/staff/login", c);
    check("signed-in cashier opening /staff/login is sent to /staff", target(l) === "/staff", `${l.status} ${target(l)}`);
    const lo = await fresh();
    await signIn(lo.page, owner);
    const lc = await cookieOf(lo.ctx);
    const l2 = await get("/staff/login", lc);
    check("signed-in owner opening /staff/login is sent to /admin", target(l2) === "/admin", `${l2.status} ${target(l2)}`);
    await lo.ctx.close();
    await ctx.close();
  });

  // ================================================================ D
  await section("D. Return to the page you asked for, when your role allows it", async () => {
    const out = await get("/admin/reports");
    const loc = out.location ?? "";
    check("signed out: /admin/reports -> login with ?next=", out.status === 307 && /\/staff\/login\?next=%2Fadmin%2Freports/.test(loc), loc);

    let r = await fresh();
    let at = await signIn(r.page, manager, "/staff/login?next=%2Fadmin%2Freports");
    check("manager returns to /admin/reports", at.pathname === "/admin/reports", at.pathname);
    await r.ctx.close();

    r = await fresh();
    at = await signIn(r.page, owner, "/staff/login?next=%2Fadmin%2Fzones%3Ftab%3D1");
    check("owner returns to a deep link with its query", at.pathname === "/admin/zones" && at.search === "?tab=1", at.pathname + at.search);
    await r.ctx.close();

    r = await fresh();
    at = await signIn(r.page, cashier, "/staff/login?next=%2Fadmin%2Freports");
    check("cashier asked for /admin/reports: lands on the board instead", at.pathname === "/staff", at.pathname);
    await r.ctx.close();

    r = await fresh();
    at = await signIn(r.page, cashier, "/staff/login?next=%2Fstaff");
    check("cashier asked for /staff: gets /staff", at.pathname === "/staff", at.pathname);
    await r.ctx.close();

    // the proxy itself carries the deep link: open a protected page signed out, then log in
    r = await fresh();
    await r.page.goto(`${BASE}/admin/offers`, { waitUntil: "domcontentloaded" });
    check("opening a protected page signed out shows the login form", /\/staff\/login/.test(r.page.url()) && /next=%2Fadmin%2Foffers/.test(r.page.url()), r.page.url().replace(BASE, ""));
    await r.page.fill("#email", manager.email);
    await r.page.fill("#password", manager.password);
    await r.page.click("button[type=submit]");
    await r.page.waitForURL("**/admin/offers", { timeout: 30000 });
    check("...and signing in returns to that page", /\/admin\/offers$/.test(r.page.url()));
    await r.ctx.close();
  });

  // ================================================================ E
  await section("E. A return path can only ever be a path inside the site", async () => {
    const evil = ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "https:evil.com", "/%2F%2Fevil.com", "%2F%2Fevil.com", "/staff/login/../../evil.com", "http://localhost:3100.evil.com", "/\t/evil.com"];
    for (const next of evil) {
      const r = await fresh();
      const at = await signIn(r.page, manager, `/staff/login?next=${encodeURIComponent(next)}`);
      const stayed = at.origin === new URL(BASE).origin;
      check(`manager with next=${JSON.stringify(next)} stays on this site`, stayed && at.pathname === "/admin", at.href.slice(0, 60));
      await r.ctx.close();
    }
    // straight at the landing endpoint with a live session, no browser form involved
    const { ctx } = await fresh();
    const page = await ctx.newPage();
    await signIn(page, cashier);
    const c = await cookieOf(ctx);
    for (const next of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)"]) {
      const r = await get(`/staff/go?next=${encodeURIComponent(next)}`, c);
      const loc = target(r) ?? "";
      check(`/staff/go?next=${JSON.stringify(next)}: sends a cashier to the board, nowhere else`, loc === "/staff", `${r.status} ${loc}`);
    }
    // the redirect param is also validated when the login page merely renders
    const lp = await get(`/staff/login?next=${encodeURIComponent("https://evil.com")}`);
    check("login page does not turn an external return path into a link, form action or script", !/(href|action|src)="[^"]*evil\.com/.test(lp.text.split("self.__next_f")[0]));
    await ctx.close();
  });

  // ================================================================ F
  await section("F. A price changed in the admin shows on /menu on the very next request", async () => {
    const cat = (await rest("categories?type=eq.restaurant&select=id&limit=1")).body[0].id;
    const { ctx, page } = await fresh();
    await signIn(page, owner);
    const c = await cookieOf(ctx);
    const save = (id, base_price) => fetch(`${BASE}/api/admin/items`, {
      method: "POST", headers: { "Content-Type": "application/json", cookie: c, "x-forwarded-for": "10.77.0.1" },
      body: JSON.stringify({ op: "save", id, item: { category_id: cat, name_ar: ITEM, description_ar: null, unit: "piece", base_price, min_qty: 1, step_qty: 1, serving_tag: null, image_url: null, available: true, active: true, featured: false, is_sample: false }, variants: [], extras: [] }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
    const priceOnMenu = async () => {
      const html = (await get("/menu")).text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      const i = html.indexOf(ITEM);
      return i < 0 ? null : html.slice(i, i + 160);
    };
    const made = await save(undefined, 777);
    itemId = made.body?.id ?? made.body?.data?.id ?? null;
    check("test item created through the admin API", made.status === 200 && !!itemId, `${made.status}`);
    let s = await priceOnMenu();
    check("/menu lists it at 777 right after it was created", !!s && /777/.test(s), s?.slice(0, 70) ?? "not listed");
    await get("/menu"); await get("/menu"); // warm: served from the cache now
    const t0 = Date.now();
    const upd = await save(itemId, 888);
    s = await priceOnMenu();
    check("changed to 888: the next /menu request already shows 888", upd.status === 200 && !!s && /888/.test(s) && !/777/.test(s), `${Date.now() - t0} ms, ${s?.slice(0, 60)}`);
    const t1 = Date.now();
    await fetch(`${BASE}/api/admin/items`, { method: "POST", headers: { "Content-Type": "application/json", cookie: c, "x-forwarded-for": "10.77.0.1" }, body: JSON.stringify({ op: "patch", id: itemId, available: false }) });
    const html = (await get("/menu")).text;
    check("marking it sold out shows on /menu at once", /خلصت/.test(html.slice(html.indexOf(ITEM) - 200, html.indexOf(ITEM) + 2500)), `${Date.now() - t1} ms`);
    // an order's price always comes from the database, never the cached page
    const q = await fetch(`${BASE}/api/quote`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": "10.77.0.2" }, body: JSON.stringify({ fulfillment: "pickup", items: [{ itemId, qty: 1, variantId: null, extraIds: [] }] }) });
    check("an unavailable item cannot be quoted (prices/availability are re-read from the database)", q.status >= 400, `${q.status}`);
    // staff-only data is never served from a shared cache
    const home = await get("/");
    check("home page has no private data (no staff or order markers)", !/order_items|customer_name|SUPABASE_SERVICE/.test(home.text));
    await ctx.close();
  });

  // ================================================================ G
  await section("G. SEO", async () => {
    const robots = await get("/robots.txt");
    check("robots.txt keeps staff, admin, api, checkout, orders and tracking out", ["/staff", "/admin", "/api/", "/checkout", "/order/", "/track"].every((p) => robots.text.includes(`Disallow: ${p}`)));
    check("robots.txt points at the sitemap", /Sitemap: https?:\/\/[^\s]+\/sitemap\.xml/.test(robots.text));
    const sm = await get("/sitemap.xml");
    const locs = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    check("sitemap lists the public pages", ["/", "/menu", "/butcher", "/offers"].every((p) => locs.includes(p)), locs.join(" "));
    check("sitemap leaves out private pages", !locs.some((p) => /staff|admin|checkout|order|track|api/.test(p)));
    const home = (await get("/")).text;
    check("home: <html lang=ar dir=rtl>", /<html lang="ar" dir="rtl"/.test(home));
    check("home: Arabic <title> and description", /<title>كباش/.test(home) && /<meta name="description" content="[^"]*[\u0600-\u06FF]/.test(home));
    const ld = home.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    let j = null;
    try { j = JSON.parse(ld?.[1] ?? ""); } catch {}
    check("home: valid Restaurant JSON-LD", j?.["@type"] === "Restaurant" && !!j.name && !!j.address?.streetAddress && Array.isArray(j.openingHoursSpecification) && j.openingHoursSpecification.length > 0 && !!j.hasMenu);
    check("JSON-LD telephone is international format", /^\+\d{9,15}$/.test(j?.telephone ?? ""), j?.telephone ? "present" : "absent");
    for (const p of ["/", "/menu", "/butcher", "/offers"]) {
      const h = (await get(p)).text;
      const og = h.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
      const img = og ? await fetch(og.replace(/^https?:\/\/[^/]+/, BASE)) : null;
      check(`${p}: og:title, og:image (reachable, image/*), canonical`, /<meta property="og:title"/.test(h) && !!img && img.ok && /^image\//.test(img.headers.get("content-type") ?? "") && /<link rel="canonical"/.test(h), og ?? "no og:image");
    }
    for (const p of ["/checkout", "/track", "/order/ABC234", "/staff/login", "/admin"]) {
      const r = await get(p);
      const body = r.text || "";
      const noindex = /<meta name="robots" content="[^"]*noindex/.test(body) || r.status === 307;
      check(`${p}: not indexable`, noindex, String(r.status));
    }
    for (const f of ["/icon.png", "/apple-icon.png", "/opengraph-image.jpg"]) {
      const r = await fetch(`${BASE}${f}`);
      check(`${f} is served`, r.ok && /^image\//.test(r.headers.get("content-type") ?? ""));
    }
  });

  // ================================================================ H
  await section("H. Error, empty and offline states", async () => {
    const { ctx, page } = await fresh();
    const r404 = await page.goto(`${BASE}/definitely-not-a-page`, { waitUntil: "domcontentloaded" });
    check("404 status code", r404.status() === 404);
    const h1 = await page.locator("h1").first().innerText();
    check("404 page: Arabic heading, a main landmark, ways forward", /الصفحة/.test(h1) && (await page.locator("main").count()) === 1 && (await page.getByRole("link", { name: "شوف المنيو" }).count()) === 1);
    await page.screenshot({ path: `${SHOTS}/p7-404.png` });

    await page.goto(`${BASE}/order/ZZZZZZ`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /مش لاقيين|لقيناش|مش موجود/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
    const t = await page.locator("main").innerText();
    check("unknown order code: friendly Arabic not-found, with a way out", /مش لاقيين|لقيناش|مش موجود/.test(t) && (await page.getByRole("link", { name: /المنيو|الرئيسية|تتبع/ }).count()) > 0, t.slice(0, 60).replace(/\n/g, " "));
    await page.screenshot({ path: `${SHOTS}/p7-order-notfound.png` });

    await page.goto(`${BASE}/order/not-a-code`, { waitUntil: "domcontentloaded" });
    check("malformed order code -> 404 page", (await page.locator("h1").first().innerText()).includes("الصفحة"));

    await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "الصينية فاضية" }).waitFor({ timeout: 20000 });
    check("empty cart: playful heading with links to the menu and butcher", (await page.getByRole("link", { name: "المنيو" }).count()) > 0 && (await page.getByRole("link", { name: "الجزارة" }).count()) > 0);
    await page.screenshot({ path: `${SHOTS}/p7-empty-cart.png` });

    await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1");
    await ctx.setOffline(true);
    const shown = await page.getByTestId("offline-banner").waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    check("offline: a banner tells the visitor", shown);
    await page.screenshot({ path: `${SHOTS}/p7-offline.png` });
    await ctx.setOffline(false);
    const gone = await page.getByTestId("offline-banner").waitFor({ state: "detached", timeout: 8000 }).then(() => true).catch(() => false);
    check("back online: the banner goes away", gone);
    await ctx.close();

    // closed restaurant: the opening hours are cached public data and "closed" is worked out in the browser,
    // so we move the browser clock to 06:00 Cairo instead of touching the real shop settings
    const override = (await rest("settings?key=eq.open_override&select=value")).body?.[0]?.value ?? "auto";
    if (override === "auto") {
      const w = await fresh();
      await w.page.clock.install({ time: new Date("2026-01-14T04:00:00Z") }); // 06:00 in Cairo, outside 12:00-01:00
      await w.page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
      const notice = w.page.getByRole("status").filter({ hasText: "النار مطفية" });
      const seen = await notice.first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
      check("closed restaurant: a clear Arabic notice on the menu, with the opening time", seen && /الساعة/.test(await notice.first().innerText().catch(() => "")));
      await w.page.screenshot({ path: `${SHOTS}/p7-closed.png` });
      await w.ctx.close();
    } else {
      console.log("SKIP  closed-notice check: open_override is not auto");
    }
  });

  // ================================================================ I
  await section("I. Reduced motion and keyboard focus", async () => {
    const ctx = await browser.newContext({ ...phone, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1");
    const r = await page.evaluate(() => {
      const els = [...document.querySelectorAll(".steam, .ember, .rise-in, .stamp-in, .animate-pulse")];
      const longest = Math.max(0, ...els.map((e) => parseFloat(getComputedStyle(e).animationDuration) * (/ms$/.test(getComputedStyle(e).animationDuration) ? 0.001 : 1)));
      return { animated: els.length, longest, mq: matchMedia("(prefers-reduced-motion: reduce)").matches };
    });
    check("reduced motion: CSS animations collapse to ~0", r.mq && r.animated > 0 && r.longest < 0.05, `${r.animated} animated elements, longest ${r.longest}s`);
    await ctx.close();

    const k = await browser.newContext({ ...phone, viewport: { width: 1000, height: 800 }, hasTouch: false, isMobile: false });
    const kp = await k.newPage();
    await kp.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
    await kp.waitForSelector("h1");
    const bad = [];
    for (let i = 0; i < 12; i++) {
      await kp.keyboard.press("Tab");
      const f = await kp.evaluate(() => {
        const e = document.activeElement;
        if (!e || e === document.body) return null;
        const s = getComputedStyle(e);
        return { tag: e.tagName, label: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 24), w: parseFloat(s.outlineWidth), style: s.outlineStyle, shadow: s.boxShadow !== "none" };
      });
      if (f && !(f.style !== "none" && f.w >= 2) && !f.shadow) bad.push(`${f.tag} "${f.label}"`);
    }
    check("keyboard focus is visible (outline >= 2px) on the first 12 tab stops of /menu", bad.length === 0, bad.join(" | "));
    await k.close();
  });


  // ================================================================ J
  await section("J. Accounts without access are turned away, and removal is immediate", async () => {
    const mk = async (label, { profile = true, active = true } = {}) => {
      const email = `p7-${label}-${TAG}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      if (profile) await admin.from("profiles").insert({ user_id: data.user.id, name: `اختبار ${label}`, role: "cashier", active });
      users[label] = { id: data.user.id, email, password, role: "cashier" };
      return users[label];
    };
    const leftLogin = (page) => page.waitForURL((u) => u.pathname.startsWith("/staff/login"), { timeout: 15000 }).then(() => true).catch(() => false);
    for (const u of [await mk("noprofile", { profile: false }), await mk("inactive", { active: false })]) {
      const { ctx, page } = await fresh();
      await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
      await page.fill("#email", u.email); await page.fill("#password", u.password); await page.click("button[type=submit]");
      await page.waitForTimeout(2500);
      await page.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
      const back = await leftLogin(page);
      check(`${u.email.split("-")[1]}: valid password but no active staff profile -> sent back to login with the Arabic reason`, back && (await page.getByText("مش متفعل كموظف").waitFor({ timeout: 8000 }).then(() => true).catch(() => false)), new URL(page.url()).pathname);
      const adm = await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      await page.waitForURL((x) => !x.pathname.startsWith("/admin"), { timeout: 15000 }).catch(() => {});
      check(`${u.email.split("-")[1]}: /admin is closed too`, !new URL(page.url()).pathname.startsWith("/admin"), new URL(page.url()).pathname);
      await ctx.close();
    }
    const c = await mk("goner");
    const { ctx, page } = await fresh();
    await signIn(page, c);
    await page.getByRole("heading", { name: "الطلبات", exact: true }).waitFor({ timeout: 20000 });
    check("an active cashier reaches the board (heading visible)", true);
    const cookie = await cookieOf(ctx);
    await admin.from("profiles").update({ active: false }).eq("user_id", c.id);
    const api = await fetch(`${BASE}/api/staff/summary`, { headers: { cookie } });
    check("deactivated: the staff API answers 401 straight away", api.status === 401, String(api.status));
    const pr = await ctx.newPage();
    await pr.goto(`${BASE}/staff`, { waitUntil: "domcontentloaded" });
    check("deactivated: the board is closed to them", await leftLogin(pr));
    await ctx.close();
  });

  check("no uncaught page errors during the run", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 160));
} catch (e) {
  check("run aborted", false, String(e.stack ?? e).split("\n").slice(0, 3).join(" | "));
} finally {
  // cleanup: the item, the users, and any rate-limit rows from this run
  if (itemId) await rest(`items?id=eq.${itemId}`, { method: "DELETE" });
  await rest(`items?name_ar=like.${encodeURIComponent(`*${MARK}*`)}`, { method: "DELETE" });
  for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id).catch(() => {});
  await browser.close();
  console.log(`\n${pass} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

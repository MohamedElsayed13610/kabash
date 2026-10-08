// Performance probe. Start the production server with SUPABASE_TIMING=1 and its output redirected to a log file:
//   SUPABASE_TIMING=1 npx next start -p 3100 > server.log 2>&1
// then:  node --env-file=.env.local scripts/perf.mjs <baseUrl> <label> <serverLog> [outJson]
// Creates one temporary owner, measures, deletes it. Never touches real accounts.
import { chromium } from "playwright-core";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";

const [BASE = "http://localhost:3100", LABEL = "run", LOG, OUT] = process.argv.slice(2);
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY, A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = (n) => Math.round(n);
const result = { label: LABEL, at: new Date().toISOString() };

// ---- Supabase round trip from this machine
const rtts = [];
for (let i = 0; i < 6; i++) {
  const t = performance.now();
  await fetch(`${U}/rest/v1/settings?select=key&limit=1`, { headers: { apikey: A } });
  rtts.push(performance.now() - t);
}
result.supabaseRttMs = ms(median(rtts.slice(1)));
console.log(`Supabase REST round trip (median of 5): ${result.supabaseRttMs} ms`);

// ---- temp owner
const admin = createClient(U, K, { auth: { persistSession: false } });
const email = `perf-${randomBytes(3).toString("hex")}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
await admin.from("profiles").insert({ user_id: created.user.id, name: "perf", role: "owner", active: true });

const ttfb = async (path, headers = {}) => {
  const t = performance.now();
  const res = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
  const first = performance.now() - t;
  await res.arrayBuffer();
  return { first: ms(first), total: ms(performance.now() - t), status: res.status };
};
const series = async (path, headers, n = 6) => {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(await ttfb(path, headers));
  return { cold: rows[0].first, warm: ms(median(rows.slice(1).map((r) => r.first))), status: rows[0].status };
};
const logSize = () => (LOG && existsSync(LOG) ? statSync(LOG).size : 0);
const logSlice = (from) => (LOG ? readFileSync(LOG, "utf8").slice(from) : "");

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  // ---- PUBLIC TTFB (before the browser logs in, so nothing is cookie-dependent)
  result.public = {};
  for (const p of ["/", "/menu", "/butcher", "/offers", "/checkout"]) {
    result.public[p] = await series(p);
    console.log(`public ${p.padEnd(10)} TTFB cold ${String(result.public[p].cold).padStart(5)} ms | warm ${String(result.public[p].warm).padStart(5)} ms  (HTTP ${result.public[p].status})`);
  }

  // ---- login (real UI) and keep the cookies
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar-EG" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => /^\/(staff|admin)\/?$/.test(u.pathname), { timeout: 30000 });
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

  // ---- ADMIN TTFB (document requests with the session)
  result.admin = {};
  for (const p of ["/admin", "/admin/menu", "/admin/zones", "/admin/offers", "/admin/reports"]) {
    result.admin[p] = await series(p, { cookie });
    console.log(`admin  ${p.padEnd(14)} TTFB cold ${String(result.admin[p].cold).padStart(5)} ms | warm ${String(result.admin[p].warm).padStart(5)} ms  (HTTP ${result.admin[p].status})`);
  }

  // ---- ROUND TRIPS behind ONE admin navigation (RSC request, like tapping a nav link)
  const from = logSize();
  const t0 = performance.now();
  await fetch(`${BASE}/admin/menu?_rsc=perf`, { headers: { cookie, rsc: "1", "next-router-prefetch": "0" } }).then((r) => r.arrayBuffer());
  const elapsed = ms(performance.now() - t0);
  const lines = logSlice(from).split("\n").filter((l) => l.startsWith("[sb]") || l.startsWith("[req]"));
  const calls = lines.filter((l) => l.startsWith("[sb]"));
  result.adminNav = { requestMs: elapsed, supabaseCalls: calls.length, calls: calls.map((l) => l.replace("[sb] ", "")) };
  console.log(`\nOne admin navigation (/admin/menu, RSC): ${elapsed} ms, ${calls.length} Supabase calls, in order:`);
  for (const l of lines) console.log("   " + l);

  // ---- REAL NAVIGATION in Chrome: tap the admin tabs and wait for the page heading
  const tap = async (name, heading) => {
    const t = performance.now();
    await page.getByRole("link", { name, exact: true }).first().click();
    await page.getByRole("heading", { name: heading, exact: true }).first().waitFor({ timeout: 60000 });
    return ms(performance.now() - t);
  };
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  const navs = [];
  for (const [n, h] of [["المنيو", "المنيو"], ["العروض", "العروض"], ["التوصيل", "مناطق التوصيل"], ["المنيو", "المنيو"], ["العروض", "العروض"], ["التوصيل", "مناطق التوصيل"]]) {
    navs.push(await tap(n, h));
    await page.waitForTimeout(400);
  }
  result.adminTapMs = { first: navs[0], all: navs, warmMedian: ms(median(navs.slice(3))) };
  console.log(`\nAdmin tab taps in Chrome (tap -> heading visible): ${navs.join(", ")} ms`);

  // ---- PUBLIC navigation in Chrome via the bottom bar, fresh visitor
  const vctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar-EG" });
  const v = await vctx.newPage();
  await v.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const pubNav = {};
  for (const [name, heading, key] of [["المنيو", "صواني الكباش", "/menu"], ["الجزارة", "جزارة كباش", "/butcher"], ["العروض", "العروض", "/offers"], ["المنيو", "صواني الكباش", "/menu#2"]]) {
    const t = performance.now();
    await v.locator("nav[aria-label=التنقل]").getByRole("link", { name, exact: false }).first().click();
    await v.getByRole("heading", { name: heading, exact: true }).first().waitFor({ timeout: 60000 });
    pubNav[key] = ms(performance.now() - t);
    await v.waitForTimeout(500);
  }
  result.publicTapMs = pubNav;
  console.log(`Public bottom-bar taps in Chrome (tap -> heading visible): ${JSON.stringify(pubNav)}`);

  // ---- same, on a slow phone: 4x CPU slowdown + Fast-3G-like network
  const sctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: "ar-EG" });
  const s = await sctx.newPage();
  const cdp = await sctx.newCDPSession(s);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  const t1 = performance.now();
  await s.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
  await s.getByRole("heading", { name: "صواني الكباش", exact: true }).first().waitFor({ timeout: 90000 });
  result.slowPhoneMenuLoadMs = ms(performance.now() - t1);
  console.log(`Slow phone (4x CPU, ~Fast 3G): /menu cold load to heading: ${result.slowPhoneMenuLoadMs} ms`);
  await sctx.close(); await vctx.close(); await ctx.close();
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(created.user.id);
}
if (OUT) writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("\nDone (temporary user deleted).");

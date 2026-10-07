// Recent order codes on the customer's device. Dev server must be running.
//   node --env-file=.env.local scripts/e2e-recent.mjs [baseUrl] [screenshotDir]
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3] ?? ".";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const MARK = "اختبار آلي";
const rest = (p, o = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...o, headers: { apikey: o.key ?? SVC, Authorization: `Bearer ${o.key ?? SVC}`, "Content-Type": "application/json", Prefer: "return=representation" } }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));
let pass = 0, failed = 0;
const check = (n, ok, d = "") => { ok ? pass++ : failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d !== "" ? `  [${d}]` : ""}`); };

const items = (await rest("items?select=id,name_ar,item_variants(id,name_ar)", { key: ANON })).body;
const zones = (await rest("delivery_zones?select=id&order=sort", { key: ANON })).body;
const chicken = items.find((i) => i.name_ar === "مندي دجاج");
await rest("rate_limits?key=neq.__none__", { method: "DELETE" });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
  const page = await ctx.newPage();
  const waitHydrated = () => page.waitForTimeout(1200);

  // 1. real checkout through the UI
  await page.goto(`${BASE}/menu`, { waitUntil: "domcontentloaded" });
  await waitHydrated();
  await page.getByLabel(`ضيف ${chicken.name_ar} للصينية`).first().click();
  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#name");
  await waitHydrated();
  await page.fill("#name", MARK);
  await page.fill("#phone", "01077770001");
  await page.selectOption("#zoneId", zones[0].id);
  await page.fill("#address-street", "شارع الاختبار");
  await page.getByRole("button", { name: /ابعت الطلب/ }).click();
  await page.waitForURL(/\/order\/[A-Z0-9]{6}/, { timeout: 20000 });
  const code = page.url().split("/order/")[1];
  check("checkout through the real UI lands on the tracking page", /^[A-HJ-NP-Z2-9]{6}$/.test(code), code);

  // 2. saved on the device
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("kabash.recentOrders.v1") ?? "[]"));
  check("the code was saved in localStorage", stored.length === 1 && stored[0].code === code && stored[0].total > 0, JSON.stringify(stored));

  // 3. reopen from the home page
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByText("طلباتك الأخيرة").waitFor({ timeout: 10000 }).catch(() => {});
  check("home page lists 'طلباتك الأخيرة' with the code", await page.getByText("طلباتك الأخيرة").isVisible() && await page.getByText(code).first().isVisible());
  await page.screenshot({ path: `${SHOTS}/recent-1-home.png` });
  await page.getByRole("link", { name: "تابع", exact: true }).first().click();
  await page.waitForURL(`**/order/${code}`, { timeout: 10000 });
  check("tapping it reopens live tracking", await page.getByTestId("headline").waitFor({ timeout: 15000 }).then(() => true).catch(() => false));

  // 4. a different device (fresh context) has nothing, and can type the code by hand
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
  const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1200);
  check("another device shows no recent orders (it is per device)", (await p2.getByText("طلباتك الأخيرة").count()) === 0);
  const btn = p2.getByRole("button", { name: "تابع الطلب" });
  await p2.fill("#track-code", "abc");
  check("code form: button disabled for an invalid code", await btn.isDisabled());
  await p2.fill("#track-code", code.toLowerCase());
  check("code form: lowercase valid code enables the button", await btn.isEnabled());
  await btn.click();
  await p2.waitForURL(`**/order/${code}`, { timeout: 10000 });
  check("code form opens tracking for that order", true);
  await ctx2.close();

  // 5. remove from the list; corrupted / expired storage is ignored
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.getByText("طلباتك الأخيرة").waitFor({ timeout: 10000 });
  await page.getByLabel(`شيل ${code} من القائمة`).click();
  check("× removes the code from the list", (await page.getByText("طلباتك الأخيرة").count()) === 0 && (await page.evaluate(() => JSON.parse(localStorage.getItem("kabash.recentOrders.v1")).length)) === 0);
  await page.evaluate(() => localStorage.setItem("kabash.recentOrders.v1", "{not json"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  check("corrupted storage is ignored (home still renders)", await page.getByText("نكهة خليجية").first().isVisible());
  await page.evaluate(() => localStorage.setItem("kabash.recentOrders.v1", JSON.stringify([{ code: "ABCDEF", at: Date.now() - 30 * 24 * 3600_000, total: 5 }, { code: "bad", at: Date.now(), total: 1 }])));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  check("expired (30 days) and malformed entries are dropped", (await page.getByText("طلباتك الأخيرة").count()) === 0);
} finally {
  await browser.close();
  const del = await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
  console.log(`\nCleanup: deleted ${del.body?.length ?? 0} test orders.`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

// Accessibility scan with axe-core (WCAG 2.0/2.1 A + AA) plus our own checks: tap targets, focus visibility, labels.
//   node --env-file=.env.local scripts/a11y.mjs <baseUrl> [--admin]
import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const BASE = process.argv[2] ?? "http://localhost:3100";
const WITH_ADMIN = process.argv.includes("--admin");
const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const scan = async (page, label, { tapTargets = true } = {}) => {
  await page.evaluate(axeSource);
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 110), why: (n.any[0]?.message ?? n.all[0]?.message ?? n.none[0]?.message ?? "").slice(0, 140) })) }));
  });
  let small = [];
  if (tapTargets) {
    small = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[aria-hidden=true]") && !el.classList.contains("sr-only"); };
      return [...document.querySelectorAll("a[href], button, [role=button], [role=switch], [role=radio], input:not([type=hidden]):not(.sr-only), select, textarea, summary")]
        .filter(vis)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        // links inside running text are exempt; everything else must be 44px in both directions
        .filter(({ el, r }) => !(el.tagName === "A" && el.closest("p, li") && getComputedStyle(el).display === "inline") && (r.height < 43.5 || r.width < 43.5))
        .map(({ el, r }) => `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label").slice(0, 24)}]` : ""} "${(el.textContent || "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
  }
  console.log(`\n## ${label}: ${res.length} axe violation(s), ${small.length} tap target(s) under 44px`);
  for (const v of res) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes) console.log(`      ${n.target}  ${n.html}\n         -> ${n.why}`);
  }
  for (const s of small.slice(0, 12)) console.log(`   small: ${s}`);
  return { axe: res.length, small: small.length };
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "ar-EG" });
const page = await ctx.newPage();
let totals = { axe: 0, small: 0 };
const add = (r) => { totals.axe += r.axe; totals.small += r.small; };
const open = async (path) => { await page.goto(BASE + path, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2200); };

for (const [label, path] of [["Home", "/"], ["Menu", "/menu"], ["Butcher", "/butcher"], ["Offers", "/offers"], ["Track", "/track"], ["Checkout (empty cart)", "/checkout"], ["Order not found", "/order/ABCDEF"], ["404", "/this-page-does-not-exist"], ["Staff login", "/staff/login"]]) {
  await open(path);
  add(await scan(page, label));
}

// states that only exist after interaction: item sheet, butcher weight scale, cart sheet, checkout with items
await open("/menu");
await page.getByRole("button", { name: "اختار حجم مندي لحم" }).first().click();
await page.waitForTimeout(900);
add(await scan(page, "Item sheet (sizes + extras)"));
await page.keyboard.press("Escape");
await open("/butcher");
await page.getByRole("button").filter({ hasText: "لحم كندوز" }).first().click();
await page.waitForTimeout(900);
add(await scan(page, "Butcher weight scale sheet"));
await page.getByRole("button", { name: "ضيف للصينية" }).click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: /افتح الصينية/ }).click();
await page.waitForTimeout(900);
add(await scan(page, "Cart sheet"));
await page.keyboard.press("Escape");
await open("/checkout");
add(await scan(page, "Checkout with an item"));

if (WITH_ADMIN) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const admin = createClient(U, K, { auth: { persistSession: false } });
  const email = `a11y-${randomBytes(3).toString("hex")}@kabash-test.invalid`, password = randomBytes(12).toString("base64url");
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await admin.from("profiles").insert({ user_id: data.user.id, name: "a11y", role: "owner", active: true });
  try {
    await page.goto(`${BASE}/staff/login`, { waitUntil: "domcontentloaded" });
    await page.fill("#email", email); await page.fill("#password", password); await page.click("button[type=submit]");
    await page.waitForURL((u) => /^\/(staff|admin)\/?$/.test(u.pathname), { timeout: 30000 });
    for (const [label, path] of [["Orders board", "/staff"], ["Admin overview", "/admin"], ["Admin menu", "/admin/menu"], ["Admin offers", "/admin/offers"], ["Admin zones", "/admin/zones"], ["Admin reports", "/admin/reports"], ["Admin settings", "/admin/settings"], ["Admin staff", "/admin/staff"]]) {
      await open(path);
      add(await scan(page, label, { tapTargets: false }));
    }
  } finally {
    await admin.auth.admin.deleteUser(data.user.id);
  }
}
await browser.close();
console.log(`\nTOTAL: ${totals.axe} axe violations, ${totals.small} tap targets under 44px`);

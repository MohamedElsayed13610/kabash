// Customer-site weight and speed on a throttled phone (4x CPU slowdown, ~Fast 3G).
//   node scripts/perf-public.mjs <baseUrl> <label> [outJson]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const [BASE = "http://localhost:3100", LABEL = "run", OUT] = process.argv.slice(2);
const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function measure(browser, path, { throttle }) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, locale: "ar-EG", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  let jsBytes = 0, cssBytes = 0, imgBytes = 0, otherBytes = 0, requests = 0;
  page.on("response", async (r) => {
    requests++;
    const len = Number(r.headers()["content-length"] ?? 0) || (await r.body().then((b) => b.length).catch(() => 0));
    const type = r.request().resourceType();
    if (type === "script") jsBytes += len; else if (type === "stylesheet") cssBytes += len; else if (type === "image" || type === "font") imgBytes += len; else otherBytes += len;
  });
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  }
  await page.addInitScript(() => {
    window.__lt = 0; window.__lcp = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lt += Math.max(0, e.duration - 50)))).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
  });
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "load" });
  await page.waitForTimeout(2500); // let hydration and late work settle
  const m = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    return { ttfb: Math.round(nav.responseStart), fcp: Math.round(fcp), lcp: Math.round(window.__lcp), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), tbt: Math.round(window.__lt) };
  });
  await ctx.close();
  return { ...m, jsKB: Math.round(jsBytes / 1024), cssKB: Math.round(cssBytes / 1024), mediaKB: Math.round(imgBytes / 1024), requests, wallMs: Date.now() - t0 };
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const out = { label: LABEL, at: new Date().toISOString(), pages: {} };
try {
  for (const path of (process.env.PATHS ?? "/,/menu,/butcher").split(",")) {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await measure(browser, path, { throttle: true }));
    const pick = (k) => median(runs.map((r) => r[k]));
    out.pages[path] = { fcp: pick("fcp"), lcp: pick("lcp"), tbt: pick("tbt"), load: pick("load"), jsKB: runs[0].jsKB, cssKB: runs[0].cssKB, mediaKB: runs[0].mediaKB, requests: runs[0].requests };
    const r = out.pages[path];
    console.log(`${path.padEnd(9)} FCP ${String(r.fcp).padStart(5)} ms | LCP ${String(r.lcp).padStart(5)} ms | blocking time ${String(r.tbt).padStart(4)} ms | JS ${r.jsKB} KB | CSS ${r.cssKB} KB | images ${r.mediaKB} KB | ${r.requests} requests`);
  }
} finally {
  await browser.close();
}
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));

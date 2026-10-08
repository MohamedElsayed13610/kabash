// Frame pacing on a throttled phone: node scripts/perf-frames.mjs <baseUrl> <label> [outJson]
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";
const [BASE = "http://localhost:3100", LABEL = "run", OUT] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const out = { label: LABEL, at: new Date().toISOString(), pages: {} };
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
for (const [name, path, scroll] of [["home idle (hero animating)", "/", false], ["home scroll", "/", true], ["menu scroll", "/menu", true]]) {
  const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "ar-EG" });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await p.goto(BASE + path, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(async (scroll) => {
    const deltas = [];
    let last = performance.now();
    const end = last + (scroll ? 3500 : 3000);
    const maxY = document.documentElement.scrollHeight - innerHeight;
    await new Promise((res) => {
      const tick = (t) => {
        deltas.push(t - last); last = t;
        if (scroll) scrollTo(0, Math.min(maxY, ((t - (end - 3500)) / 3500) * maxY));
        t < end ? requestAnimationFrame(tick) : res();
      };
      requestAnimationFrame(tick);
    });
    return deltas.slice(2);
  }, scroll);
  const dropped = r.filter((d) => d > 33.4).length;
  out.pages[name] = { frames: r.length, p50: Math.round(pct(r, 0.5)), p95: Math.round(pct(r, 0.95)), worst: Math.round(Math.max(...r)), slowFramesPct: Math.round((dropped / r.length) * 100) };
  const o = out.pages[name];
  console.log(`${name.padEnd(28)} frames ${String(o.frames).padStart(4)} | median ${o.p50} ms | p95 ${o.p95} ms | worst ${o.worst} ms | frames slower than 30fps: ${o.slowFramesPct}%`);
  await ctx.close();
}
await b.close();
if (OUT) writeFileSync(OUT, JSON.stringify(out, null, 2));

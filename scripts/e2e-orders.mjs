// End-to-end + abuse test for order creation. Run with the dev server up:
//   node --env-file=.env.local scripts/e2e-orders.mjs [baseUrl]
// Creates rows tagged with MARK, prints them, then deletes them. Restores any setting it touches.
const BASE = process.argv[2] ?? "http://localhost:3100";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MARK = "اختبار آلي";

const rest = (path, { key = SVC, ...init } = {}) =>
  fetch(`${URL_}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation", ...init.headers },
  }).then(async (r) => ({ status: r.status, body: r.status === 204 ? null : await r.json().catch(() => null) }));

const api = (path, body, ip = "10.0.0.1", raw) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: raw ?? JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

let pass = 0, failed = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  [${detail}]` : ""}`);
};
const resetLimits = () => rest("rate_limits?key=neq.__none__", { method: "DELETE" });
const phoneN = (() => { let n = 0; return () => `010999900${String(++n).padStart(2, "0")}`; })();

// ---------- load real ids ----------
const get = async (p) => (await rest(p, { key: ANON })).body;
const cats = await get("categories?select=id,name_ar,type");
const items = await get("items?select=id,name_ar,base_price,category_id,item_variants(id,name_ar,price_delta),item_extras(id,name_ar,price)");
const zones = await get("delivery_zones?select=*&order=sort");
const item = (n) => items.find((i) => i.name_ar === n);
const mandi = item("مندي لحم"), kandoz = item("لحم كندوز"), chicken = item("مندي دجاج");
const large = mandi.item_variants.find((v) => v.name_ar === "كبير");
const yog = mandi.item_extras.find((e) => e.name_ar === "سلطة زبادي");
const drink = mandi.item_extras.find((e) => e.name_ar === "مشروب");
const zone2 = zones[1];
console.log(`Using zone "${zone2.name_ar}" fee=${zone2.fee} min=${zone2.min_order}\n`);

const goodOrder = (over = {}) => ({
  name: MARK, phone: phoneN(), fulfillment: "delivery", zoneId: zone2.id,
  address: { street: "شارع الاختبار", building: "5", landmark: "جنب الكوبري" },
  notes: "طلب اختبار آلي، مش حقيقي", payment: "cash",
  lines: [
    { itemId: mandi.id, variantId: large.id, extraIds: [yog.id, drink.id], qty: 2 },
    { itemId: kandoz.id, qty: 1.5 },
  ],
  ...over,
});

const settingsBefore = Object.fromEntries((await rest("settings?select=key,value")).body.map((r) => [r.key, r.value]));
let created = [];
try {
  await resetLimits();

  // ---------- 1. full order ----------
  console.log("== 1. Full order: mandi (size+2 extras) x2, butcher 1.5kg, delivery zone, offers ==");
  // expected, computed by hand from the seed: mandi large 430 + 15 + 15 = 460 x2 = 920; kandoz 420 x 1.5 = 630
  // subtotal 1550; category offer 10% on mandi = 92; cart offer fixed 30; delivery 20
  const expected = { subtotal: 1550, discount: 122, delivery: Number(zone2.fee), total: 1550 - 122 + Number(zone2.fee) };
  const q = await api("/api/quote", { fulfillment: "delivery", zoneId: zone2.id, lines: goodOrder().lines }, "10.1.0.1");
  check("quote 200", q.status === 200, q.status);
  check("quote subtotal", q.body?.totals?.subtotal === expected.subtotal, q.body?.totals?.subtotal);
  check("quote discount", q.body?.totals?.discountTotal === expected.discount, q.body?.totals?.discountTotal);
  check("quote total", q.body?.totals?.total === expected.total, q.body?.totals?.total);

  const o1 = goodOrder();
  const r1 = await api("/api/orders", o1, "10.1.0.2");
  check("order created 201", r1.status === 201, `${r1.status} ${JSON.stringify(r1.body)}`);
  const code1 = r1.body?.code;
  check("code is 6 chars from the safe alphabet", /^[A-HJ-NP-Z2-9]{6}$/.test(code1 ?? ""), code1);
  check("response total matches server math", r1.body?.total === expected.total, r1.body?.total);

  const [ord] = (await rest(`orders?code=eq.${code1}&select=*`)).body;
  const lines = (await rest(`order_items?order_id=eq.${ord.id}&select=*&order=name_snapshot`)).body;
  const events = (await rest(`order_events?order_id=eq.${ord.id}&select=*`)).body;
  created.push(ord.id);
  console.log("\n  orders row:", JSON.stringify({ code: ord.code, name: ord.customer_name, phone: ord.phone, fulfillment: ord.fulfillment, zone: ord.zone_name, subtotal: ord.subtotal_estimate, discount: ord.discount_total, fee: ord.delivery_fee, total: ord.total_estimate, status: ord.status, butcher: ord.has_butcher, restaurant: ord.has_restaurant, address: ord.address_json }));
  for (const l of lines) console.log("  order_items:", JSON.stringify({ name: l.name_snapshot, unit: l.unit, qty: l.qty_requested, unit_price: l.unit_price_snapshot, line: l.line_total_estimate, snapshot: l.variant_snapshot }));
  console.log("  order_events:", JSON.stringify(events.map((e) => ({ status: e.status, note: e.note }))), "\n");
  check("order row totals", Number(ord.subtotal_estimate) === 1550 && Number(ord.discount_total) === 122 && Number(ord.delivery_fee) === 20 && Number(ord.total_estimate) === expected.total);
  check("order status new + both board flags", ord.status === "new" && ord.has_butcher && ord.has_restaurant);
  check("delivery fee + zone name snapshotted", Number(ord.delivery_fee) === Number(zone2.fee) && ord.zone_name === zone2.name_ar);
  check("2 order_items saved", lines.length === 2);
  const lm = lines.find((l) => l.name_snapshot === "مندي لحم"), lk = lines.find((l) => l.name_snapshot === "لحم كندوز");
  check("mandi line: unit price 460 x2 = 920, size+extras snapshotted", Number(lm.unit_price_snapshot) === 460 && Number(lm.line_total_estimate) === 920 && lm.variant_snapshot.variant.name === "كبير" && lm.variant_snapshot.extras.length === 2);
  check("butcher line: 1.5kg x 420 = 630 (estimate, no final yet)", lk.unit === "kg" && Number(lk.qty_requested) === 1.5 && Number(lk.line_total_estimate) === 630 && lk.qty_final === null && lk.line_total_final === null);
  check("line discounts sum to order discount", Math.abs(lines.reduce((s, l) => s + l.variant_snapshot.discount, 0) - 122) < 0.005);
  check("order_events has the first 'new' event", events.length === 1 && events[0].status === "new");

  const page = await fetch(`${BASE}/order/${code1}`);
  const html = await page.text();
  check("confirmation page shows the code and total", page.status === 200 && html.includes(code1) && html.includes("1,448"), page.status);

  // ---------- 2. tampering ----------
  console.log("\n== 2. Tampering ==");
  const tampered = goodOrder({
    total: 1, subtotal: 1, deliveryFee: 0, discountTotal: 9999, total_estimate: 1, price: 1,
    lines: [{ itemId: mandi.id, variantId: large.id, extraIds: [yog.id], qty: 1, price: 1, unitPrice: 1, unit_price: 1, base_price: 1, lineTotal: 1 }],
  });
  const rt = await api("/api/orders", tampered, "10.2.0.1");
  check("tampered order still accepted (extra fields ignored)", rt.status === 201, rt.status);
  const [ot] = (await rest(`orders?code=eq.${rt.body.code}&select=*`)).body; created.push(ot.id);
  // 250+180+15 = 445, category offer 10% = 44.5 -> 44.5, cart fixed 30 -> 370.5, + 20 delivery = 390.5
  check("saved total ignores the client's prices (server math)", Number(ot.total_estimate) === 390.5 && Number(ot.subtotal_estimate) === 445, `saved total=${ot.total_estimate} subtotal=${ot.subtotal_estimate}`);
  const [oti] = (await rest(`order_items?order_id=eq.${ot.id}&select=*`)).body;
  check("saved unit price is the DB price (460 - 15 = 445)", Number(oti.unit_price_snapshot) === 445, oti.unit_price_snapshot);

  const bad = async (name, over, expectStatus, ip) => {
    const r = await api("/api/orders", goodOrder(over), ip);
    check(`${name} -> ${expectStatus}`, r.status === expectStatus, `${r.status} ${r.body?.error?.message ?? ""}`);
    return r;
  };
  await bad("negative quantity", { lines: [{ itemId: mandi.id, variantId: large.id, qty: -2 }] }, 400, "10.2.0.2");
  await bad("zero quantity", { lines: [{ itemId: mandi.id, variantId: large.id, qty: 0 }] }, 400, "10.2.0.2");
  await bad("0.3 kg when step is 0.5", { lines: [{ itemId: kandoz.id, qty: 0.3 }] }, 422, "10.2.0.2");
  await bad("1.25 kg off-step", { lines: [{ itemId: kandoz.id, qty: 1.25 }] }, 422, "10.2.0.2");
  await bad("200 kg", { lines: [{ itemId: kandoz.id, qty: 200 }] }, 400, "10.2.0.2");
  await bad("fractional pieces", { lines: [{ itemId: chicken.id, qty: 1.5 }] }, 422, "10.2.0.2");
  await bad("size missing on an item with sizes", { lines: [{ itemId: mandi.id, qty: 1 }] }, 422, "10.2.0.2");
  await bad("size from a different item", { lines: [{ itemId: chicken.id, variantId: large.id, qty: 1 }] }, 422, "10.2.0.2");
  await bad("extra that doesn't belong to the item", { lines: [{ itemId: chicken.id, extraIds: [yog.id], qty: 1 }] }, 422, "10.2.0.2");
  await bad("non-existent item id", { lines: [{ itemId: "00000000-0000-4000-8000-000000000000", qty: 1 }] }, 422, "10.2.0.2");
  await bad("item id that isn't a UUID", { lines: [{ itemId: "'; drop table orders;--", qty: 1 }] }, 400, "10.2.0.2");
  await bad("empty cart", { lines: [] }, 400, "10.2.0.2");
  await bad("delivery without a zone", { zoneId: null }, 400, "10.2.0.2");
  await bad("delivery without an address", { address: { street: "", building: "", landmark: "" } }, 400, "10.2.0.2");
  await bad("zone id that doesn't exist", { zoneId: "00000000-0000-4000-8000-000000000000" }, 409, "10.2.0.2");
  await bad("unsupported payment method", { payment: "card" }, 400, "10.2.0.2");
  await bad("name too short", { name: "ا" }, 400, "10.2.0.2");
  const rj = await api("/api/orders", null, "10.2.0.3", "{not json");
  check("malformed JSON -> 400", rj.status === 400, rj.status);
  const rb = await api("/api/orders", null, "10.2.0.3", JSON.stringify({ notes: "x".repeat(30000) }));
  check("oversized body -> 413", rb.status === 413, rb.status);

  // inactive zone and hidden item (restored in finally)
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
  const rz = await api("/api/orders", goodOrder(), "10.2.0.4");
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ active: zone2.active }) });
  check("disabled zone is refused -> 409", rz.status === 409, `${rz.status} ${rz.body?.error?.message}`);
  await rest(`items?id=eq.${chicken.id}`, { method: "PATCH", body: JSON.stringify({ available: false }) });
  const ri = await api("/api/orders", goodOrder({ lines: [{ itemId: chicken.id, qty: 1 }] }), "10.2.0.4");
  await rest(`items?id=eq.${chicken.id}`, { method: "PATCH", body: JSON.stringify({ available: true }) });
  check("out-of-stock item is refused -> 422", ri.status === 422, `${ri.status} ${ri.body?.error?.message}`);
  const minZone = await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ min_order: 5000 }) });
  const rm = await api("/api/orders", goodOrder(), "10.2.0.4");
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ min_order: zone2.min_order }) });
  check("below the zone's minimum order is refused -> 422", rm.status === 422, `${rm.status} ${rm.body?.error?.message}`);
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ fee: 99 }) });
  const rf = await api("/api/orders", goodOrder(), "10.2.0.5");
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ fee: zone2.fee }) });
  const [of_] = (await rest(`orders?code=eq.${rf.body.code}&select=*`)).body; created.push(of_.id);
  const [old1] = (await rest(`orders?id=eq.${ord.id}&select=delivery_fee`)).body;
  check("  new order used fee 99; first order still 20", Number(of_.delivery_fee) === 99 && Number(old1.delivery_fee) === 20, `${of_.delivery_fee} / ${old1.delivery_fee}`);

  // nothing from the rejected attempts should have been saved
  const markRows = (await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}&select=id,code`)).body;
  check("rejected orders left no rows behind", markRows.length === created.length, `${markRows.length} rows vs ${created.length} accepted`);

  // ---------- 3. phones ----------
  console.log("\n== 3. Phone validation ==");
  const badPhones = ["12345", "0201234567890", "01312345678", "010123456", "0101234567890", "abcdefghijk", "", "+1 202 555 0100", "0101234567a"];
  for (const p of badPhones) {
    const r = await api("/api/orders", goodOrder({ phone: p }), "10.3.0.1");
    check(`invalid phone ${JSON.stringify(p)} -> 400`, r.status === 400, `${r.status}`);
  }
  const phoneVariants = [["٠١٠٩٩٩٩٠٠٩١", "Arabic-Indic digits"], ["+20 10 9999 0092", "+20 with spaces"], ["010-9999-0093", "dashes"], ["201099990094", "20 prefix"]];
  for (const [p, label] of phoneVariants) {
    const r = await api("/api/orders", goodOrder({ phone: p }), "10.3.0.2");
    check(`valid phone accepted: ${label}`, r.status === 201, `${r.status} ${r.body?.error?.message ?? ""}`);
    if (r.body?.code) { const [x] = (await rest(`orders?code=eq.${r.body.code}&select=id,phone`)).body; created.push(x.id); check(`  normalised to 01099990xxx`, /^01099990\d{3}$/.test(x.phone), x.phone); }
  }

  // ---------- 4. closed ----------
  console.log("\n== 4. Closed restaurant ==");
  await rest("settings?key=eq.open_override", { method: "PATCH", body: JSON.stringify({ value: "closed" }) });
  const rc = await api("/api/orders", goodOrder(), "10.4.0.1");
  check("closed + toggle off -> 403", rc.status === 403, `${rc.status} ${rc.body?.error?.message}`);
  await rest("settings?key=eq.accept_orders_when_closed", { method: "PATCH", body: JSON.stringify({ value: true }) });
  const rc2 = await api("/api/orders", goodOrder(), "10.4.0.1");
  check("closed + toggle on -> accepted", rc2.status === 201, rc2.status);
  if (rc2.body?.code) { const [x] = (await rest(`orders?code=eq.${rc2.body.code}&select=id`)).body; created.push(x.id); }

  // ---------- 5. rate limiting ----------
  console.log("\n== 5. Rate limiting ==");
  await resetLimits();
  const samePhone = "01099990099";
  const par = await Promise.all(Array.from({ length: 6 }, () => api("/api/orders", goodOrder({ phone: samePhone }), "10.5.0.1")));
  const ok = par.filter((r) => r.status === 201), lim = par.filter((r) => r.status === 429);
  for (const r of ok) { const [x] = (await rest(`orders?code=eq.${r.body.code}&select=id`)).body; created.push(x.id); }
  check("6 parallel orders, same phone: exactly 3 accepted, 3 limited", ok.length === 3 && lim.length === 3, `${ok.length} ok / ${lim.length} limited`);
  check("429 message is Arabic", /استنى/.test(lim[0]?.body?.error?.message ?? ""));
  const other = await api("/api/orders", goodOrder({ phone: "01099990098" }), "10.5.0.1");
  check("a different phone from the same IP is still fine", other.status === 201, other.status);
  if (other.body?.code) { const [x] = (await rest(`orders?code=eq.${other.body.code}&select=id`)).body; created.push(x.id); }

  await resetLimits();
  const burst = await Promise.all(Array.from({ length: 45 }, () => api("/api/orders", { name: "x" }, "10.5.0.2")));
  const invalid = burst.filter((r) => r.status === 400).length, limited = burst.filter((r) => r.status === 429).length;
  check("45 rapid requests from one IP: first 30 pass the limiter, rest blocked", invalid === 30 && limited === 15, `${invalid} reached validation / ${limited} blocked`);
  const otherIp = await api("/api/orders", { name: "x" }, "10.5.0.3");
  check("another IP is unaffected", otherIp.status === 400, otherIp.status);

  await resetLimits();
  const qb = await Promise.all(Array.from({ length: 70 }, () => api("/api/quote", { fulfillment: "pickup", lines: [{ itemId: mandi.id, variantId: large.id, qty: 1 }] }, "10.5.0.4")));
  check("quote endpoint limited at 60/min", qb.filter((r) => r.status === 200).length === 60 && qb.filter((r) => r.status === 429).length === 10, `${qb.filter((r) => r.status === 200).length} ok`);

  // ---------- 6. honeypot + RLS ----------
  console.log("\n== 6. Honeypot and direct database access ==");
  await resetLimits();
  const before = (await rest(`orders?select=id`)).body.length;
  const hp = await api("/api/orders", goodOrder({ website: "http://spam.example" }), "10.6.0.1");
  const after = (await rest(`orders?select=id`)).body.length;
  check("honeypot filled: fake success, nothing saved", hp.status === 200 && before === after, `${hp.status}, rows ${before}->${after}`);
  const direct = await rest("orders", { key: ANON, method: "POST", body: JSON.stringify({ code: "HACK22", customer_name: "x", phone: "01012345678", fulfillment: "pickup", subtotal_estimate: 0, total_estimate: 0 }) });
  check("anon key cannot insert an order directly", direct.status === 401 || direct.status === 403, direct.status);
  const readAnon = await rest("orders?select=id,phone", { key: ANON });
  check("anon key cannot read orders", Array.isArray(readAnon.body) && readAnon.body.length === 0);
  const readItems = await rest("order_items?select=id", { key: ANON });
  check("anon key cannot read order_items", Array.isArray(readItems.body) && readItems.body.length === 0);
  const priceEdit = await rest(`items?id=eq.${mandi.id}`, { key: ANON, method: "PATCH", body: JSON.stringify({ base_price: 1 }) });
  const [still] = (await rest(`items?id=eq.${mandi.id}&select=base_price`)).body;
  check("anon key cannot change a menu price", Number(still.base_price) === Number(mandi.base_price), `price still ${still.base_price}`);
} finally {
  // restore settings, clean test data
  for (const k of ["open_override", "accept_orders_when_closed"]) {
    await rest(`settings?key=eq.${k}`, { method: "PATCH", body: JSON.stringify({ value: settingsBefore[k] }) });
  }
  await rest(`delivery_zones?id=eq.${zone2.id}`, { method: "PATCH", body: JSON.stringify({ fee: zone2.fee, min_order: zone2.min_order, active: zone2.active }) });
  await rest(`items?id=eq.${chicken.id}`, { method: "PATCH", body: JSON.stringify({ available: true }) });
  const del = await rest(`orders?customer_name=eq.${encodeURIComponent(MARK)}`, { method: "DELETE" });
  await resetLimits();
  console.log(`\nCleanup: deleted ${del.body?.length ?? 0} test orders (items/events cascade), settings restored, rate limits cleared.`);
}
console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

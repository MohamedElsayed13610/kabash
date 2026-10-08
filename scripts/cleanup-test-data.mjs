// Removes everything the e2e scripts create (all tagged) and restores the original owner-facing settings.
//   node --env-file=.env.local scripts/cleanup-test-data.mjs
import { createClient } from "@supabase/supabase-js";
const U = process.env.NEXT_PUBLIC_SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(U, K, { auth: { persistSession: false } });
const h = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json", Prefer: "return=representation" };
const rest = (p, o = {}) => fetch(`${U}/rest/v1/${p}`, { ...o, headers: h }).then(async (r) => (r.status === 204 ? [] : await r.json().catch(() => [])));
const like = encodeURIComponent("*اختبار آلي*");
const out = {};
out.orders = (await rest(`orders?customer_name=eq.${encodeURIComponent("اختبار آلي")}`, { method: "DELETE" })).length;
out.offers = (await rest(`offers?title_ar=like.${like}`, { method: "DELETE" })).length;
out.zones = (await rest(`delivery_zones?name_ar=like.${like}`, { method: "DELETE" })).length;
out.items = (await rest(`items?name_ar=like.${like}`, { method: "DELETE" })).length;
out.categories = (await rest(`categories?name_ar=like.${like}`, { method: "DELETE" })).length;
let users = 0;
const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
for (const u of data.users) if (u.email?.endsWith("@kabash-test.invalid")) { await admin.auth.admin.deleteUser(u.id); users++; }
out.testUsers = users;
// orphaned test photos (anything in items/ or offers/ that no row references)
const used = new Set([...(await rest("items?select=image_url")), ...(await rest("offers?select=image_url"))].map((r) => r.image_url).filter(Boolean).map((u) => u.split("/menu/")[1]));
let photos = 0;
for (const folder of ["items", "offers"]) {
  const { data: files } = await admin.storage.from("menu").list(folder, { limit: 1000 });
  const orphans = (files ?? []).filter((f) => f.name !== ".emptyFolderPlaceholder" && !used.has(`${folder}/${f.name}`)).map((f) => `${folder}/${f.name}`);
  if (orphans.length) { await admin.storage.from("menu").remove(orphans); photos += orphans.length; }
}
out.orphanPhotos = photos;
const patch = (key, value) => rest(`settings?key=eq.${key}`, { method: "PATCH", body: JSON.stringify({ value }) });
const cur = Object.fromEntries((await rest("settings?select=key,value")).map((r) => [r.key, r.value]));
await patch("accept_orders_when_closed", false);
await patch("open_override", "auto");
await patch("announcement_ar", "");
await patch("free_delivery_threshold", 0);
await patch("restaurant_info", { ...cur.restaurant_info, whatsapp: "201038473110", phone: "01038473110" });
await patch("opening_hours", { ...cur.opening_hours, days: cur.opening_hours.days.map((d) => ({ ...d, closed: false })) });
await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
console.log("cleaned:", JSON.stringify(out));

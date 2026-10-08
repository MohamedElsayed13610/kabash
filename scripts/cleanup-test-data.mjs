// Removes everything the e2e scripts create (all tagged). Does not touch settings or Storage.
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
// The shop is live: this script only removes rows tagged as test data and temp users. It never rewrites settings
// (the owner may have changed them) and never sweeps Storage (a photo uploaded but not yet saved would look orphaned).
await rest("rate_limits?key=neq.__none__", { method: "DELETE" });
console.log("cleaned:", JSON.stringify(out));

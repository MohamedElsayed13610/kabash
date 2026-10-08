# KABASH (كباش): working rules

Arabic-first (`lang="ar" dir="rtl"`) ordering site + staff board + admin for a Gulf-style restaurant with a butcher shop. Full spec: `kabash-claude-code-prompt (4).md`.

## Stack
Next.js App Router + TypeScript, Tailwind v4 (logical properties only: `ms-*`, `pe-*`, `start-*`, never `ml/pr/left/right`), Supabase (Postgres, Auth, Storage, Realtime), `motion`, Zod, Vitest.

## Non-negotiables
- Prices shown with **Western digits** + `ج.م`. Money logic lives in `src/lib/pricing` (pure, tested). **Never trust client prices**: the server recomputes totals from the DB.
- RLS on every table. Orders are created/tracked only via server routes using the service role. Zones, fees, hours, free-delivery threshold are DB-driven, never hardcoded.
- Closed restaurant: browsing works, checkout shows a closed message unless the admin toggle `accept_orders_when_closed` is on.
- All UI strings go in `src/messages/ar.ts` (i18n-ready; no English build yet).
- Sample data is flagged `is_sample`; show a "عينة" badge in the admin. No real phone numbers in the repo.

## Design: "الصينية" (the shared tray)
- Tokens (CSS vars in `globals.css`): `--forest` anchor, `--ember` actions, `--saffron` prices/highlights, `--charcoal` text, `--ivory` ground, `--leaf` logo highlight green for rings and thin lines. Ember is for fills with ivory text, not small text on ivory.
- Fonts: **Lalezar** (display: headlines, prices, never paragraphs) + **IBM Plex Sans Arabic** (body). Not Inter/Cairo.
- Motifs: round tray shapes for categories, cart as a tray, ram emblem as a stamp, scale-style weight picker, "طازج النهارده" label, serving tags. Sadu/woven patterns only as thin dividers.
- Avoid the AI look: purple gradients, glassmorphism, identical rounded cards everywhere, emoji icons, centered vague hero + two buttons, 3-column feature grids, lorem ipsum, side accent bars. Use asymmetry, big type, tight food crops, color blocks. Placeholders are color blocks with the item name in the display font, never gray boxes.
- Motion: few, well-made moments. Animate `transform`/`opacity` only. Respect `prefers-reduced-motion`. Content must be visible at rest (no JS-gated hiding).
- Mobile first: 360px, 44px+ tap targets, bottom-reachable primary actions, cheap Android on mobile data.

## Order pricing rules (src/lib/pricing/order.ts, tested)
- Server recomputes everything from DB rows; the client sends only item ids, variant/extra ids and quantities. Unknown fields are stripped by Zod.
- Per cart line: at most ONE item/category offer (the best). A fixed amount applies once per line, capped at the line total.
- At most ONE cart offer (the best), applied after line offers and split across lines by net amount.
- Zone minimum and free-delivery threshold are judged on the goods total after discounts. Pickup never pays a fee.
- Each line's discount (incl. its share of any cart offer) is snapshotted in `order_items.variant_snapshot.discount` so Phase 5 can recompute butcher finals.
- Rate limits (DB-backed, `rate_limit_hit`): orders 30/10min per IP (carrier NAT shares IPs), 3/10min per phone; quotes 60/min per IP.
- Run `node --env-file=.env.local scripts/e2e-orders.mjs` (dev server up) to re-test orders and abuse cases. It cleans up after itself.

## Admin dashboard (Phase 6)
- Routes: `/admin` (owner + manager), `/admin/settings` and `/admin/staff` (owner only). Cashiers go to `/staff`. Pages AND `/api/admin/*` both check the role on the server (`adminPage()` / `adminRoute()`); the proxy is only the front door.
- All writes go through `/api/admin/<resource>` with Zod (`src/lib/validation/admin.ts`) and the service role. Photos upload straight from the browser to Storage (RLS allows owner/manager), after client-side crop + WebP compression (`ImageUploader`). Only URLs from our own `menu` bucket are accepted for `image_url`.
- Free-delivery "off" is stored as `0` (JSON null becomes SQL NULL, which `settings.value` refuses). Always read it through `normalizeThreshold()`.
- Editors must never open from stale data: every admin API answer carries the server time `at`, each page stamps `renderedAt` BEFORE its reads, and `useAdmin().ready()` waits until a render newer than the last save arrived. Switches are optimistic (local `opt` map cleared when props change).
- Reorder rows use `layout="position"` only (full layout animation squashes expanded content).
- Charts: validated palette for the two-category split (`#35a35f` / `#c2410c`), single-series bars, table view available, `dir="ltr"` charts with Western digits.
- Tracking section: the customer's device keeps ONLY code, time, total, last status and type (`kabash.recentOrders.v1`). Never phone numbers or addresses. Status is polled in one batched call (`/api/track-status`, max 5 codes, unknown codes count against the same 20-per-10-min guess limit).
- Tests: `scripts/e2e-admin.mjs`, `e2e-staff.mjs`, `e2e-track-section.mjs`, `e2e-tracking.mjs`, `e2e-orders.mjs` (dev server up; each cleans up after itself).

## Speed, caching and access (Phase 7)
- Auth per request: `getStaff()` (`src/lib/server/staff.ts`, React `cache()`) verifies the JWT locally with `getClaims()` (no network), then reads `profiles` (role + active) once. Never call `supabase.auth.getUser()` on a hot path. Pages and `/api/admin|staff/*` still check the role on the server; the proxy only redirects.
- Public data (menu, offers, zones, public settings) lives in `src/lib/data.ts` behind tagged `fetch` caching (`menu`, `offers`, `zones`, `settings`). Every admin write ends with `revalidatePublic()` (`revalidateTag(t, {expire:0})` + `revalidatePath`), so changes show on the next request. 5 min is only a safety net. Open/closed is computed in the browser from the cached hours. NEVER read orders, tracking, checkout totals, staff or admin data through `data.ts`. Order prices are recomputed from the DB on the server.
- Admin pages run their independent reads with `Promise.all` and select only the columns they use. Admin and staff data is never cached.
- Landing after login: one form at `/staff/login`; `/staff/go` decides from the DB role (owner/manager -> `/admin`, cashier -> `/staff`). The return path (`?next=`) goes through `safeNext()` in `src/lib/safe-redirect.ts` (same-site path only, no `//`, backslashes, control chars or schemes) and is dropped if the role may not open it. The board shows a "لوحة التحكم" link only to owner/manager; `/admin` has a link back to the board.
- Pages behind `loading.tsx` stream, so a server `redirect()` there arrives as a refresh meta tag with status 200 (browsers behave the same). Tests read both forms.
- SEO: `metadataBase` from `NEXT_PUBLIC_SITE_URL`; use `pageMeta()` (`src/lib/site.ts`) for public pages (a page-level `openGraph` drops the file-convention image, so the helper repeats it); Restaurant JSON-LD on `/` is built from live settings; `sitemap.ts`/`robots.ts` list only public pages. Share image and icons are generated by `scripts/prepare-seo-assets.mjs`.
- Accessibility: all muted text is `text-charcoal/70` or darker (4.5:1 on ivory). Tap targets are 44px+. Run `node --env-file=.env.local scripts/a11y.mjs <url> --admin` (axe + tap targets) against a production build.
- States: `not-found.tsx`, `error.tsx` (root and `(site)`, the latter shows call/WhatsApp from `ContactProvider`), `global-error.tsx`, `OfflineBanner`.
- Perf probes: `scripts/perf.mjs` (needs the server started with `SUPABASE_TIMING=1`), `perf-public.mjs`, `perf-frames.mjs`. Numbers are in `docs/perf-report.md`. Phase 7 tests: `scripts/e2e-phase7.mjs`.

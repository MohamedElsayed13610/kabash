# Performance report (Phase 7, part 1)

Measured on the **production build** (`next start`) from a Windows PC in Egypt to the live Supabase project.
Round trip from this PC to Supabase REST: **140–205 ms**. On Vercel in Frankfurt next to the database it is typically 10–40 ms,
so the absolute numbers below will be **lower on Vercel**; what carries over is the **number of sequential round trips** and the work done per request.
Probe scripts: `scripts/perf.mjs`, `scripts/perf-public.mjs`, `scripts/perf-frames.mjs`. Turn on per-call logging with `SUPABASE_TIMING=1`.

## Admin (this was the slow part)

What one admin navigation did BEFORE (tapping "المنيو"), in order:

| # | Call | Time |
|---|---|---|
| 1 | proxy: ask Supabase Auth "who is this?" (`/auth/v1/user`) | 474 ms |
| 2 | layout: ask Auth again | 1,396 ms |
| 3 | page: ask Auth again | 475 ms |
| 4 | (a further Auth check) | 474 ms |
| 5 | layout: staff profile lookup | 132 ms |
| 6 | page: staff profile lookup (same query again) | 132 ms |
| 7 | the menu: one deeply nested query | 1,015 ms |

= **7 calls, 3.55 s**.

AFTER: the session token is verified **locally** (`getClaims()`, ES256 signing keys, 1–2 ms, no network), the profile is looked up **once per request**
(React `cache()` shares it between layout and page, and it is still read from the database on every request, so a stopped account is locked out at once),
and the data is loaded in parallel with the check:

= **5 calls, all in parallel, 0 auth calls: 259 ms** (a later run with a cold connection pool: 712 ms; every call then took one connection setup).

| Measure | Before | After |
|---|---|---|
| One admin navigation, server work | 3,551 ms (7 calls, serial) | **259 ms** (5 calls, parallel) |
| Admin page time to first byte, warm: `/admin/menu` | 1,380 ms | **~200 ms** |
| `/admin/zones` | 1,566 ms | **~180 ms** |
| `/admin/offers` | 2,856 ms | **~200 ms** |
| `/admin/reports` | 4,088 ms | **~210 ms** |
| `/admin` (overview) | 1,936 ms | **~240–520 ms** |
| Tap a tab in Chrome until the page heading shows | 1.3 to 2.9 s | **0.36 to 0.5 s** (a few 1.4 s outliers while two servers ran) |

Also: reports and the daily summary now run two parallel queries instead of a chain; the menu loads in four small flat parallel queries instead of one nested query;
all admin routes have a loading skeleton and their links prefetch to it. Admin data is never cached; every API route still checks the role.

## Customer site

Public pages were already pre-rendered (`○` in the build output): time to first byte **5–11 ms warm, 20–200 ms cold** locally, taps 70–260 ms.
What changed there:

* **Tagged server cache** for menu, offers, delivery zones and public settings (`src/lib/data.ts`). Saving anything in the admin expires the tags immediately
  (`revalidateTag(tag, { expire: 0 })`) and refreshes the pages, so the site shows the change on the next request. A 5-minute timer is only a safety net.
  Orders, tracking, checkout totals, admin and staff pages are never cached; prices are re-read from the database when an order is placed.
* Menu data is fetched as four parallel minimal queries (not one nested query) and shared per render.
* Checkout reads its zones from the same cache (invalidated by the admin) instead of querying on every visit.
* Open/closed is worked out in the browser from the cached hours.
* Bottom-bar pages are prefetched when the browser is idle; the tapped tab lights up instantly (`useLinkStatus`).

Throttled phone (4x CPU slowdown, ~Fast 3G), medians of 3 interleaved runs, original vs now:

| | Original | Now |
|---|---|---|
| Home: first contentful paint | 2,160 ms | **1,784 ms** |
| Home: main-thread blocking time | 1,245 ms | **929 ms** |
| `/menu`: blocking time | 510 ms | 540 ms (same, within noise) |
| `/butcher`: blocking time | 438 ms | ~690 ms (noisy) |
| Frame pacing while scrolling (4x CPU) | median 8 ms, p95 16-24 ms | unchanged (already smooth) |

### Found while measuring
A site-wide `loading.tsx` skeleton **doubled** main-thread blocking time on `/menu` and `/butcher` (about 1,100-1,700 ms vs 510 ms). It was removed.
Loading the animation library lazily made no measurable difference, so it is bundled normally.

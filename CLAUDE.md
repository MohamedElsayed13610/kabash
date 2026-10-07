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
- Tokens (CSS vars in `globals.css`): `--forest` anchor, `--ember` actions, `--saffron` prices/highlights, `--charcoal` text, `--ivory` ground, `--silver` thin lines. Ember is for fills with ivory text, not small text on ivory.
- Fonts: **Lalezar** (display: headlines, prices, never paragraphs) + **IBM Plex Sans Arabic** (body). Not Inter/Cairo.
- Motifs: round tray shapes for categories, cart as a tray, ram emblem as a stamp, scale-style weight picker, "طازج النهارده" label, serving tags. Sadu/woven patterns only as thin dividers.
- Avoid the AI look: purple gradients, glassmorphism, identical rounded cards everywhere, emoji icons, centered vague hero + two buttons, 3-column feature grids, lorem ipsum, side accent bars. Use asymmetry, big type, tight food crops, color blocks. Placeholders are color blocks with the item name in the display font, never gray boxes.
- Motion: few, well-made moments. Animate `transform`/`opacity` only. Respect `prefers-reduced-motion`. Content must be visible at rest (no JS-gated hiding).
- Mobile first: 360px, 44px+ tap targets, bottom-reachable primary actions, cheap Android on mobile data.

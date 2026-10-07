# KABASH (كباش) — Online Ordering Website + Admin Dashboard

You are building a production website for **Kabash (كباش)**, a Gulf-style restaurant with Egyptian soul ("أكل خليجي بروح مصرية") that also runs a **fresh butcher shop** (لحوم ومصنعات فريش يوميًا). Location: بني مزار – طريق الساحة – أمام كوب (Egypt).

Menu themes: مندي، مدفون، برياني، مضغوط، صواني ومشاوي. Butcher: fresh meat and processed meat products sold by weight.

Read this whole file first. Then write a short plan (stack, folder structure, phases, DB schema) and start building phase by phase. Commit after each phase. Only stop to ask me when something truly blocks you (see "Things I must provide").

---

## 1. What we are building

Three connected parts, one codebase:

1. **Customer site (mobile-first, Arabic RTL)**: browse the restaurant menu and the butcher shop, build a cart, place an order.
2. **Orders board (for the restaurant/butcher staff)**: new orders appear live with a sound, staff move them through statuses.
3. **Admin dashboard**: manage menu items, prices, photos, categories, offers, delivery zones, opening hours, and staff accounts.

Most customers will use cheap Android phones on mobile data in Egypt. Design and performance decisions must start from that.

---

## 2. Stack (use unless you have a strong reason not to)

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**.
- **Tailwind CSS** with logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`) so RTL is correct by construction.
- **Supabase**: Postgres, Auth (staff accounts), Storage (item photos, offer banners), Realtime (live orders board).
- **Motion**: `motion` (Framer Motion) for UI transitions, plus plain CSS/SVG for ambient effects. Keep the JS animation bundle small.
- Zod for validation on both client and server.
- PWA for the staff side (installable, so the cashier can pin it to the home screen and get the sound alert).

Security rules:
- Enable Row Level Security on every table. Public can read only active menu data. Orders can be created through a server route only. Staff access depends on role.
- **Never trust prices from the client.** The server recalculates every order total from the database.
- Rate limit order creation (per IP and per phone number). Validate Egyptian mobile numbers (`01[0125]xxxxxxxx`).
- Keep secrets in env vars. Provide `.env.example`.

---

## 3. Language, direction, locale

- Arabic first, `lang="ar" dir="rtl"`. All UI copy in natural Egyptian-friendly Arabic, not stiff translated text.
- Currency: EGP, shown as `ج.م`. Use Arabic-Indic or Western digits consistently (choose Western digits for prices for clarity, and say so in the plan).
- Structure the code so an English version can be added later (i18n-ready strings), but do not build English now.

---

## 4. Design direction (this matters most)

The owner explicitly does **not** want a site that looks AI-generated or template-like. Treat this as a brand identity job, not a UI kit job.

### Brand facts to design from
- Logo: a ram (كبش) emblem inside a deep green circle with a thin silver ring, Arabic wordmark "كباش" with "KABASH" under it. Deep forest green is the brand color.
- Cover art: dark green ground, big white Arabic lettering, a hand holding a woven bowl of grilled meat and vegetables.
- Personality: warm, generous, communal. Big trays shared by many people. Fire, smoke, spice, rice, the table.

### Creative concept
Pick ONE strong idea and commit to it. Suggested direction (you may improve it, but stay specific to this brand):

**"The Sini" (الصينية).** The shared serving tray is the visual motif. Sections feel like trays being laid out on a table. Menu categories could be presented as round tray shapes seen from above. Cart is a tray you fill. Use woven-basket and Sadu-style geometric patterns very sparingly as texture and dividers (this fuses the Gulf side with Egyptian warmth), never as wallpaper.

Palette: derive from the logo. Deep forest green as the anchor, plus warm ember (flame orange), saffron or brass accents, charcoal, and a warm off-white. Define them as CSS variables with names that come from the subject (for example `--ember`, `--saffron`, `--charcoal`, `--forest`). Check contrast for Arabic text on every background.

Typography: Arabic type carries the personality. Use Google Fonts (via `next/font`, self-hosted subsets for speed). Pair a characterful Arabic display face for headlines and prices (consider Lalezar, Rakkas, Reem Kufi, Aref Ruqaa, or similar, and test them with real copy) with a very readable Arabic body face (consider Readex Pro, IBM Plex Sans Arabic, Tajawal, or similar). Do not use Inter or Cairo as the default. Do not let the display face run long paragraphs.

### Things that make a site look AI-generated. Avoid all of them
- Purple/blue gradient heroes, glassmorphism on everything, generic blob backgrounds.
- Every section built from the same rounded card with the same shadow.
- Emoji as section icons or bullets.
- Centered hero with a vague tagline and two buttons.
- Stock-looking symmetrical 3-column "features" grids.
- Lorem ipsum or generic copy. Write real Arabic copy for this restaurant.
- Accent bar on the side of rounded cards.

### What to do instead
- Real asymmetry and rhythm. Large type, tight crops on food, overlapping elements, tray shapes, strong color blocks.
- One memorable hero moment (see animation), then calmer sections.
- Food photography is the star. Use full-bleed or generously cropped images. Until real photos exist, use tasteful color-block placeholders with the item name set in the display font, never gray boxes, and make swapping in real photos trivial.
- Details only this brand would have: weight selectors in the butcher shop styled like a scale, a "الصينية تكفي ٤ أفراد" serving-size tag, the ram emblem used as a stamp, "طازج النهارده" freshness label on butcher items.

---

## 5. Animation (important, but disciplined)

Make the site feel alive on a phone. Prioritize a few well-made moments over lots of small effects.

- **Hero**: steam rising from the tray and a soft ember/fire flicker (SVG or canvas, lightweight). The ram emblem or the wordmark reveals with a confident motion on load.
- **Scroll reveals**: sections slide and settle in with staggered timing. Never leave content hidden at rest. If JS is slow, content must still be visible.
- **Add to cart**: the item visually flies into the cart tray/button, the cart count bumps. Haptic feedback (`navigator.vibrate`) where supported.
- **Cart and item detail** open as **bottom sheets** with drag-to-dismiss and spring physics.
- **Category switching**: sticky horizontal category chips with a sliding active indicator. Smooth scroll-spy as the user scrolls the menu.
- **Order status page**: animated progress through the stages (received, preparing, out for delivery, delivered) with a small scene (pot, scooter) that changes.
- **Butcher weight picker**: tactile stepper with a satisfying animation when weight changes and the estimated price updates (numbers roll).
- **Admin**: keep it fast and calm. Small transitions only. New order arriving gets a clear but short highlight and a sound.

Rules:
- Respect `prefers-reduced-motion`.
- Animate only `transform` and `opacity` where possible.
- Test on a throttled mid-range Android profile. Target smooth 60fps scrolling and a fast first load (lazy-load below-the-fold images, serve WebP/AVIF, size images properly).

---

## 6. Customer site: features and pages

**Routes**
- `/` Home: hero, today's offers, restaurant highlights, butcher highlights, how to order, branch info, opening hours, open/closed status.
- `/menu` Restaurant menu with sticky categories.
- `/butcher` Butcher shop with categories and weight-based ordering.
- `/cart` (or bottom sheet) and `/checkout`.
- `/order/[code]` Order tracking by short order code (no login needed).
- `/offers` Current offers.

**Ordering rules**
- Restaurant items are ordered by quantity, with optional variants (size, portion, extras). Example: tray size for مندي.
- Butcher items are priced **per kg** and ordered by weight in steps (for example 0.5 kg steps, configurable per item with a minimum). The total shown is an **estimate**. Show clear text that the final price is confirmed after weighing, and let staff adjust the final weight/price in the orders board before delivery.
- Checkout fields: name, mobile number, delivery or pickup, address (area picked from the delivery zones list, plus street/building/landmark), notes, payment method.
- Payment: **cash on delivery** only for now. Build the payment method as an enum so online payment can be added later.
- Delivery fee comes from the selected zone (admin-managed). Free-delivery threshold optional.
- Offers apply automatically (percent or fixed amount, optional date range, applies to an item, a category, or the whole cart).
- Optional: after placing the order, show a button that opens WhatsApp with the order summary so the customer can also message the restaurant. The order itself is already saved in the database.
- When the restaurant is closed, the site still works for browsing and can accept scheduled/next-day orders or show a clear closed message (admin toggle decides).
- Remember the customer's name, phone, and address on their device for next time (local storage, no account needed).

---

## 7. Orders board (staff)

- Login required. Mobile-friendly and also good on a tablet at the counter.
- Live list via Supabase Realtime: new orders appear instantly, with a **loud repeating sound until acknowledged** (browsers require a first user tap to unlock audio, so add a clear "تفعيل الصوت" button on login/start).
- Separate filters for restaurant orders and butcher orders, plus status tabs.
- Statuses: `new → accepted → preparing → out_for_delivery → delivered`, plus `cancelled` (with reason). Each change is saved with timestamp and who did it.
- Order card shows items, notes, address, phone (tap to call, tap to WhatsApp), total, estimate vs final for butcher items.
- Butcher items can be edited after weighing (actual weight, final price), and the customer's tracking page updates.
- Printable order slip (thermal-printer friendly layout, 58mm/80mm CSS).
- Simple daily summary: number of orders, revenue, top items.

---

## 8. Admin dashboard

Roles: `owner` (everything), `manager` (menu, offers, orders, no staff/settings), `cashier` (orders only). Owner creates staff accounts.

Sections:
- **Menu manager**: categories (restaurant and butcher), items with name, description, price, variants/extras, unit (piece or kg), min weight and step for butcher items, serving-size tag, photo upload, "available now" toggle (out of stock), featured flag, drag-to-reorder.
- **Photo upload**: client-side resize/compress to WebP before upload, crop to a consistent aspect ratio, instant preview. Store in Supabase Storage.
- **Offers**: title, description, banner image, discount type/value, target (item/category/cart), start/end dates, active toggle. Active offers show on the homepage automatically.
- **Delivery zones (fully admin-managed)**: the admin adds, edits, disables, reorders, and deletes zones. Nothing about zones or fees is hardcoded in the code. Each zone has: area name, delivery fee, optional minimum order, estimated delivery time, and an active toggle. Optional global setting: free delivery above a cart total chosen by the admin. Changing a fee in the admin applies immediately to new orders (old orders keep the fee they were placed with). The checkout zone list reads live from the database, and disabled zones disappear from it. Owner and manager roles can edit zones; cashiers cannot.
- **Settings**: opening hours per day, manual open/closed override, WhatsApp number, phone numbers, branch address, social links, announcement banner text.
- **Staff**: invite, change role, deactivate.
- **Reports**: orders and revenue by day/week, top items, restaurant vs butcher split.

The admin UI should be fast, uncluttered, and usable one-handed on a phone. It does not need the same expressive branding as the customer site, but it must still feel like part of the brand (same colors and type).

---

## 9. Data model (starting point, refine as needed)

`categories` (id, type: restaurant|butcher, name_ar, sort, active)
`items` (id, category_id, name_ar, description_ar, unit: piece|kg, base_price, min_qty, step_qty, serving_tag, image_url, available, featured, sort)
`item_variants` (id, item_id, name_ar, price_delta)
`offers` (id, title_ar, description_ar, image_url, discount_type, discount_value, target_type, target_id, starts_at, ends_at, active)
`delivery_zones` (id, name_ar, fee, min_order, eta_minutes, active)
`orders` (id, code, customer_name, phone, fulfillment: delivery|pickup, zone_id, address_json, notes, payment_method, subtotal_estimate, delivery_fee, discount_total, total_estimate, total_final, status, created_at)
`order_items` (id, order_id, item_id, name_snapshot, unit, qty_requested, qty_final, unit_price_snapshot, variant_snapshot)
`order_events` (id, order_id, status, by_user, note, created_at)
`settings` (key, value_json)
`profiles` (user_id, name, role)

Always snapshot names and prices into `order_items` so old orders never change when the menu changes.

---

## 10. Seed data

Create seed data so the site looks real on day one. All items are **sample content** and must be clearly marked in the admin as sample (prices are placeholders that the owner will replace):
- Restaurant: مندي لحم، مندي دجاج، مدفون، برياني، مضغوط، صواني ومشاوي (various sizes).
- Butcher: لحم كندوز، لحم ضاني، كفتة، سجق، برجر، دجاج طازج (priced per kg).
- 2 sample offers, 3 sample delivery zones (marked as sample, and the admin can edit or delete them).
Do not invent a real phone number. Use obvious placeholders in `.env` and settings.

---

## 11. Quality bar

- Lighthouse mobile: performance 85+, accessibility 95+.
- Works on 360px wide screens, with large tap targets (44px+), and thumb-reachable primary actions (bottom bar for cart/checkout).
- Visible focus states, sufficient contrast, semantic HTML, proper `alt` text in Arabic.
- SEO: Arabic metadata, Open Graph image using the brand, `LocalBusiness`/`Restaurant` structured data, sitemap.
- Error and empty states written in Arabic with personality (empty cart, closed restaurant, offline).
- Tests for the order total calculation (variants, weights, offers, delivery fee) since money logic must be right.
- Write a `README.md` with setup steps, env vars, how to create the first owner account, and how to deploy. Write a `CLAUDE.md` summarizing the design rules above so future sessions stay consistent.

---

## 12. Build order

1. Project setup, RTL, fonts, design tokens, brand assets, Supabase schema + RLS + seed.
2. Customer menu (restaurant + butcher) with the final visual direction and animations.
3. Cart, checkout, server-side order creation and total calculation.
4. Order tracking page.
5. Staff login and live orders board with sound.
6. Admin: menu manager with photo upload, then offers, zones, settings, staff, reports.
7. Polish pass: animation tuning on throttled devices, accessibility, SEO, empty/error states.
8. Deploy to Vercel and write the handover README.

After each phase, tell me in a few lines what works and how I can test it on my phone.

---

## 13. Things I must provide (ask me once, at the start, and then continue with placeholders)

- Logo file and cover image (I'll put them in `/public/brand/`: `logo.png`, `cover.jpg`). Do not hotlink from Facebook.
- Restaurant phone and WhatsApp numbers.
- Real menu, prices, and photos (replace the sample data later from the admin).
- Delivery zones and fees are NOT needed from me. I will enter them myself from the admin dashboard.
- Supabase project URL and keys, and a Vercel account connection.
- Domain name, if any.

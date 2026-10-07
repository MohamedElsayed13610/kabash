// Builds the staff PWA / notification icons from public/brand/logo.png.
// Usage: node scripts/make-staff-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const out = "public/staff-icons";
const logo = "public/brand/logo.png";
const FOREST = "#0b5128";
mkdirSync(out, { recursive: true });

for (const size of [192, 512]) {
  await sharp(logo).resize(size, size).png().toFile(`${out}/icon-${size}.png`);
}

// Maskable: logo inside the safe zone (~66%) on a solid forest square, so any mask shape works.
const bg = (size) => ({ create: { width: size, height: size, channels: 4, background: FOREST } });
const inner512 = await sharp(logo).resize(340, 340).png().toBuffer();
await sharp(bg(512)).composite([{ input: inner512, gravity: "center" }]).png().toFile(`${out}/maskable-512.png`);

// iOS home-screen icon: opaque square, no transparency.
const inner180 = await sharp(logo).resize(150, 150).png().toBuffer();
await sharp(bg(180)).composite([{ input: inner180, gravity: "center" }]).png().toFile(`${out}/apple-touch-icon.png`);

// Android notification badge: monochrome shape, only the alpha channel matters.
const badge = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><path fill="#fff" fill-rule="evenodd" d="M48 4a44 44 0 1 0 0 88 44 44 0 0 0 0-88zm0 11a33 33 0 1 1 0 66 33 33 0 0 1 0-66z"/><circle cx="48" cy="48" r="15" fill="#fff"/></svg>`,
);
await sharp(badge).png().toFile(`${out}/badge-96.png`);

console.log("staff icons written to", out);

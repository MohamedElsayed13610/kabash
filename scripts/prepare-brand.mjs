// Crops the owner's supplied logo/cover into web-ready brand assets.
// Usage: node scripts/prepare-brand.mjs <logo-src> <cover-src>
import sharp from "sharp";

const [logoSrc, coverSrc] = process.argv.slice(2);
const out = "public/brand";

// Logo: circular crop with transparent corners.
const size = 860;
const cx = 507;
const cy = 512;
const square = await sharp(logoSrc)
  .extract({ left: cx - size / 2, top: cy - size / 2, width: size, height: size })
  .toBuffer();
const OUT = 640;
const mask = Buffer.from(
  `<svg width="${OUT}" height="${OUT}"><circle cx="${OUT / 2}" cy="${OUT / 2}" r="${OUT / 2 - 2}" fill="#fff"/></svg>`,
);
await sharp(square)
  .resize(OUT)
  .ensureAlpha()
  .composite([{ input: mask, blend: "dest-in" }])
  .png({ compressionLevel: 9 })
  .toFile(`${out}/logo.png`);

// Cover: strip the black letterbox bars (visible band is y 288..774 of 1024).
await sharp(coverSrc)
  .extract({ left: 0, top: 288, width: 1536, height: 486 })
  .jpeg({ quality: 88 })
  .toFile(`${out}/cover.jpg`);

// The hand + tray on its own, for the hero.
await sharp(coverSrc)
  .extract({ left: 0, top: 300, width: 470, height: 450 })
  .jpeg({ quality: 90 })
  .toFile(`${out}/tray.jpg`);

console.log("done");

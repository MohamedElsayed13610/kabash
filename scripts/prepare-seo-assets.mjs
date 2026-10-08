// Builds the share image and icons from the brand files. Run: node scripts/prepare-seo-assets.mjs
import sharp from "sharp";

const FOREST_DEEP = "#05301a";
const FOREST = "#0b5128";

// Open Graph / Twitter card, 1200x630: the cover strip centred on deep green (the logo is already part of the cover).
const W = 1200;
const H = 630;
const strip = await sharp("public/brand/cover.jpg").resize({ width: W }).toBuffer(); // 1200 x ~380
const stripH = (await sharp(strip).metadata()).height;
await sharp({ create: { width: W, height: H, channels: 3, background: FOREST_DEEP } })
  .composite([
    { input: strip, left: 0, top: Math.round((H - stripH) / 2) },
  ])
  .jpeg({ quality: 86 })
  .toFile("src/app/opengraph-image.jpg");
await sharp("src/app/opengraph-image.jpg").toFile("src/app/twitter-image.jpg");

// Browser tab icon and home-screen icon (iOS wants an opaque square).
await sharp("public/brand/logo.png").resize(192).png({ compressionLevel: 9, palette: true }).toFile("src/app/icon.png");
const apple = await sharp("public/brand/logo.png").resize(150).toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 3, background: FOREST } })
  .composite([{ input: apple, left: 15, top: 15 }])
  .png()
  .toFile("src/app/apple-icon.png");

console.log("done");

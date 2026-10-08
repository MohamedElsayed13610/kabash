import type { Metadata } from "next";
import type { SiteSettings } from "./types";

/** Public origin of the site. Set NEXT_PUBLIC_SITE_URL on Vercel; the fallbacks keep previews and local runs sane. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3100";
}

export const SITE_NAME = "كباش";

/** Pages that set their own openGraph/twitter lose the file-convention image, so it is repeated here. */
const SHARE_IMAGE = "/opengraph-image.jpg";

/** Title/description/canonical/Open Graph for one public page. The share image comes from app/opengraph-image. */
export function pageMeta(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", locale: "ar_EG", siteName: SITE_NAME, title, description, url: path, images: [{ url: SHARE_IMAGE, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [SHARE_IMAGE] },
  };
}

const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Egyptian mobile in local form (010…) to international (+2010…). Anything else is left out rather than guessed. */
function toInternational(phone: string): string | undefined {
  return /^01\d{9}$/.test(phone) ? `+2${phone}` : /^\d{8,15}$/.test(phone) ? `+${phone}` : undefined;
}

/** schema.org Restaurant for the home page, built from the live (cached) settings so it never drifts from the site. */
export function restaurantJsonLd(settings: SiteSettings, origin: string) {
  const info = settings.restaurant_info;
  const telephone = toInternational(info.phone);
  const sameAs = [info.social.facebook, info.social.instagram].filter((u): u is string => !!u && /^https?:\/\//.test(u));
  const hours = settings.opening_hours.days
    .filter((d) => !d.closed)
    .map((d) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: SCHEMA_DAYS[d.day],
      opens: d.open,
      closes: d.close,
    }));
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    "@id": `${origin}/#restaurant`,
    name: info.name_ar || SITE_NAME,
    alternateName: "Kabash",
    description: "أكل خليجي بروح مصرية: مندي ومدفون وبرياني ومضغوط وصواني ومشاوي، وجزارة لحوم ومصنعات فريش.",
    url: origin,
    image: [`${origin}/opengraph-image.jpg`, `${origin}/brand/logo.png`],
    logo: `${origin}/brand/logo.png`,
    servesCuisine: ["Middle Eastern", "Gulf", "Mandi", "Grill"],
    ...(telephone ? { telephone } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: info.address_ar,
      addressCountry: "EG",
    },
    ...(hours.length ? { openingHoursSpecification: hours } : {}),
    hasMenu: `${origin}/menu`,
    acceptsReservations: false,
    paymentAccepted: "Cash",
    currenciesAccepted: "EGP",
    ...(sameAs.length ? { sameAs } : {}),
  };
}

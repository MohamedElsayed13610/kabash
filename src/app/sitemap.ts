import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Only the public, indexable pages. Orders, tracking, checkout, staff and admin are deliberately absent. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/menu`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/butcher`, changeFrequency: "daily", priority: 0.9 },
    { url: `${origin}/offers`, changeFrequency: "daily", priority: 0.7 },
  ];
}

import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = siteUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/staff", "/admin", "/api/", "/checkout", "/order/", "/track"] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

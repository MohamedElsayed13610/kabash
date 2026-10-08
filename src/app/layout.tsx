import type { Metadata, Viewport } from "next";
import { Lalezar, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { SITE_NAME, siteUrl } from "@/lib/site";
import { OfflineBanner } from "@/components/site/OfflineBanner";

const display = Lalezar({
  subsets: ["arabic", "latin"],
  weight: "400",
  variable: "--font-lalezar",
  display: "swap",
});

const body = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-plex",
  display: "swap",
});

const TITLE = "كباش | أكل خليجي بروح مصرية ولحوم فريش";
const DESCRIPTION = "مندي ومدفون وبرياني ومضغوط وصواني ومشاوي، وجزارة لحوم ومصنعات فريش يوميًا. بني مزار – طريق الساحة – أمام كوب.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { type: "website", locale: "ar_EG", siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = { themeColor: "#0b5128", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${display.variable} ${body.variable}`}>
      <body>
        <MotionProvider>{children}</MotionProvider>
        <OfflineBanner />
      </body>
    </html>
  );
}

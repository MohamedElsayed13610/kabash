import type { Metadata, Viewport } from "next";
import { Lalezar, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { MotionProvider } from "@/components/ui/MotionProvider";
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

export const metadata: Metadata = {
  title: "كباش | أكل خليجي بروح مصرية ولحوم فريش",
  description: "مندي ومدفون وبرياني ومضغوط وصواني ومشاوي، وجزارة لحوم ومصنعات فريش يوميًا. بني مزار – طريق الساحة – أمام كوب.",
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

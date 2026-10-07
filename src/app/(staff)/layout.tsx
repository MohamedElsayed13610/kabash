import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "طلبات كباش",
  manifest: "/staff.webmanifest",
  robots: { index: false, follow: false },
  icons: { icon: "/staff-icons/icon-192.png", apple: "/staff-icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "طلبات كباش", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0b5128", width: "device-width", initialScale: 1 };

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata, Viewport } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { adminPage } from "@/lib/server/admin-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "لوحة التحكم | كباش", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#0b5128", width: "device-width", initialScale: 1 };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // cashiers are sent to the orders board; everyone else sees the dashboard (individual pages narrow it further)
  const staff = await adminPage(["owner", "manager"]);
  return <AdminShell staff={{ name: staff.name, role: staff.role }}>{children}</AdminShell>;
}

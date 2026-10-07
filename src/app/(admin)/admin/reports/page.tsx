import { ReportsView } from "@/components/admin/ReportsView";
import { adminPage } from "@/lib/server/admin-page";
import { getReport } from "@/lib/server/reports";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await adminPage(["owner", "manager"]);
  const raw = Number((await searchParams).days);
  const days = [7, 30, 90].includes(raw) ? raw : 7;
  return <ReportsView report={await getReport(days)} />;
}

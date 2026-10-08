import { ReportsView } from "@/components/admin/ReportsView";
import { adminPage } from "@/lib/server/admin-page";
import { getReport } from "@/lib/server/reports";

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const raw = Number((await searchParams).days);
  const days = [7, 30, 90].includes(raw) ? raw : 7;
  const [, report] = await Promise.all([adminPage(["owner", "manager"]), getReport(days)]);
  return <ReportsView report={report} />;
}

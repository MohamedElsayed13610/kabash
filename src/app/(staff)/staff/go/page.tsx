import { redirect } from "next/navigation";
import { landingFor } from "@/lib/safe-redirect";
import { getStaff } from "@/lib/server/staff";

export const dynamic = "force-dynamic";

/**
 * The single place that decides where a freshly signed-in person lands, using the role stored in the database
 * (never anything sent by the browser) and a return path validated on the server.
 */
export default async function AfterLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const staff = await getStaff();
  if (!staff) redirect("/staff/login");
  redirect(landingFor(staff.role, (await searchParams).next));
}

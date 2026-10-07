import "server-only";
import { redirect } from "next/navigation";
import { getStaff, type Staff, type StaffRole } from "./staff";

/** For admin pages: signed-out -> login, wrong role -> somewhere they ARE allowed. */
export async function adminPage(roles: StaffRole[]): Promise<Staff> {
  const s = await getStaff();
  if (!s) redirect("/staff/login");
  if (!roles.includes(s.role)) redirect(s.role === "cashier" ? "/staff" : "/admin");
  return s;
}

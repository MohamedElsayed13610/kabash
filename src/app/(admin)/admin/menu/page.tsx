import { MenuManager } from "@/components/admin/MenuManager";
import { adminPage } from "@/lib/server/admin-page";
import { loadAdminMenu } from "@/lib/server/menu-data";

export default async function AdminMenuPage() {
  const renderedAt = Date.now(); // before the reads: the data below is at least this fresh
  // The role check (shared with the layout through cache()) and the data load run side by side.
  // The data is only used if the check passes; a failed check redirects before anything is rendered.
  const [, categories] = await Promise.all([adminPage(["owner", "manager"]), loadAdminMenu()]);
  return <MenuManager categories={categories} renderedAt={renderedAt} />;
}

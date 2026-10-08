"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AdminProvider } from "./AdminProvider";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { unsubscribeThisDevice } from "../staff/PushButton";

type Role = "owner" | "manager" | "cashier";

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: "/admin", label: "نظرة عامة", roles: ["owner", "manager"] },
  { href: "/admin/menu", label: "المنيو", roles: ["owner", "manager"] },
  { href: "/admin/offers", label: "العروض", roles: ["owner", "manager"] },
  { href: "/admin/zones", label: "التوصيل", roles: ["owner", "manager"] },
  { href: "/admin/reports", label: "التقارير", roles: ["owner", "manager"] },
  { href: "/admin/settings", label: "الإعدادات", roles: ["owner"] },
  { href: "/admin/staff", label: "الموظفين", roles: ["owner"] },
];

const ROLE_LABEL = { owner: "المالك", manager: "المدير", cashier: "الكاشير" } as const;

export function AdminShell({ staff, children }: { staff: { name: string; role: Role }; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const nav = useRef<HTMLElement>(null);

  // keep the active tab in view in the scrolling nav
  useEffect(() => {
    nav.current?.querySelector<HTMLElement>("[aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [path]);

  async function logout() {
    await unsubscribeThisDevice();
    await createSupabaseBrowser().auth.signOut();
    router.replace("/staff/login");
  }

  return (
    <AdminProvider>
      <div className="min-h-dvh bg-ivory pb-24">
        <header className="sticky top-0 z-30 bg-forest text-ivory">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/admin" className="flex items-center gap-3">
              <Image src="/brand/logo.png" alt="" width={40} height={40} className="size-10" />
              <span className="leading-tight">
                <span className="block font-display text-2xl">لوحة التحكم</span>
                <span className="block text-xs text-ivory/75">
                  {staff.name} · {ROLE_LABEL[staff.role]}
                </span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/staff" data-testid="to-board" className="grid h-11 place-items-center rounded-full border border-leaf/50 px-4 text-sm">
                الطلبات
              </Link>
              <button onClick={logout} className="h-11 rounded-full border border-leaf/50 px-4 text-sm">
                خروج
              </button>
            </div>
          </div>
          <nav ref={nav} aria-label="أقسام لوحة التحكم" className="no-scrollbar mx-auto flex max-w-4xl gap-1 overflow-x-auto px-3 pb-2">
            {NAV.filter((n) => n.roles.includes(staff.role)).map((n) => {
              const on = n.href === "/admin" ? path === "/admin" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={`grid h-12 shrink-0 place-items-center rounded-full px-5 font-medium ${on ? "bg-ivory text-forest" : "text-ivory"}`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 pt-5">{children}</main>
      </div>
    </AdminProvider>
  );
}

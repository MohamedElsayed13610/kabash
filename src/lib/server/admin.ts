import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_TAGS } from "@/lib/data";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { ApiError } from "./order-service";
import { fail, readJson } from "./http";
import { requireStaff, type Staff, type StaffRole } from "./staff";

export const MENU_ROLES: StaffRole[] = ["owner", "manager"];
export const OWNER_ONLY: StaffRole[] = ["owner"];

export const db = () => createSupabaseAdmin();

/** Public pages are cached for a minute; after an admin change, refresh them right away. */
export function revalidatePublic() {
  // expire: 0 = never serve the old copy; the next visitor gets fresh data straight away
  for (const t of PUBLIC_TAGS) revalidateTag(t, { expire: 0 });
  for (const p of ["/", "/menu", "/butcher", "/offers", "/checkout"]) revalidatePath(p);
}

/** Wraps an admin API route: auth + role, size-limited JSON, validation, uniform errors. */
export function adminRoute<T>(roles: StaffRole[], schema: ZodType<T>, handler: (input: T, staff: Staff) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const staff = await requireStaff(roles);
      const input = await readJson(req, schema);
      const out = await handler(input, staff);
      // `at` (server clock) lets the browser know whether a page render already includes this change
      return NextResponse.json({ ...((out as object) ?? { ok: true }), at: Date.now() });
    } catch (e) {
      return fail(e);
    }
  };
}

/** Throws a friendly 500 for unexpected database errors. */
export function must<T>(res: { data: T; error: { message: string } | null }, message = "مقدرناش نحفظ التعديل. جرب تاني."): T {
  if (res.error) {
    console.error("[admin]", res.error.message);
    throw new ApiError(500, "db_error", message);
  }
  return res.data;
}

/** Same, but the row must exist (insert ... .single()). */
export function mustOne<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  const v = must(res);
  if (v === null || v === undefined) throw new ApiError(500, "db_error", "مقدرناش نحفظ التعديل. جرب تاني.");
  return v as NonNullable<T>;
}

/** Same, for list queries: never null. */
export function mustList<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return must(res) ?? [];
}

/** Re-numbers `sort` to match the given order of ids. */
export async function applyOrder(table: "categories" | "items" | "delivery_zones", ids: string[]) {
  await Promise.all(ids.map((id, i) => db().from(table).update({ sort: i + 1 }).eq("id", id).then((r) => must(r))));
}

/** Deletes an uploaded file from the menu bucket (best effort). */
export async function removeImage(url: string | null | undefined) {
  const marker = "/storage/v1/object/public/menu/";
  if (!url || !url.includes(marker)) return;
  await db().storage.from("menu").remove([url.split(marker)[1]]).catch(() => {});
}

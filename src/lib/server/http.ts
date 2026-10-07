import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ApiError } from "./order-service";

const MAX_BODY = 20_000;

export function fail(e: unknown) {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message, fields: e.fields } }, { status: e.status });
  }
  console.error("[api]", e);
  return NextResponse.json({ error: { code: "server_error", message: "حصلت مشكلة. جرب تاني بعد شوية." } }, { status: 500 });
}

/** Reads a small JSON body and validates it. Throws ApiError(400/413). */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ApiError(413, "too_large", "الطلب كبير أوي.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "bad_json", "البيانات مش مفهومة.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
    throw new ApiError(400, "invalid", Object.values(fields)[0] ?? "راجع البيانات اللي كتبتها.", fields);
  }
  return parsed.data;
}

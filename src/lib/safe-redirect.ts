export type Role = "owner" | "manager" | "cashier";

// control characters (0x00-0x1f, 0x7f) and backslashes: both are used in open-redirect tricks such as "/\evil.com"
const FORBIDDEN = new RegExp("[\\u0000-\\u001f\\u007f\\\\]");

/**
 * A "where to go after login" value from the URL, accepted ONLY if it is a plain path inside this site.
 * Everything else (other sites, protocol-relative URLs, backslash tricks, control characters, javascript:, data:)
 * returns null. Always run it on the SERVER; the browser's copy is only a hint.
 */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 300) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (FORBIDDEN.test(raw)) return null;
  try {
    const u = new URL(raw, "http://internal.invalid");
    if (u.origin !== "http://internal.invalid") return null;
    return u.pathname + u.search; // normalised: "/staff/../x" becomes "/x"
  } catch {
    return null;
  }
}

export const defaultLanding = (role: Role) => (role === "cashier" ? "/staff" : "/admin");

/**
 * Where a signed-in staff member should land. Honors the page they were trying to open when their role allows it:
 *  - cashiers: only the orders board (/staff/*)
 *  - managers: the board and /admin/*, but not /admin/settings or /admin/staff
 *  - owners: everything
 * Anything else falls back to the role's default.
 */
export function landingFor(role: Role, rawNext: unknown): string {
  const fallback = defaultLanding(role);
  const next = safeNext(rawNext);
  if (!next) return fallback;
  const path = next.split("?")[0];

  if (path === "/staff/login" || path === "/staff/go" || path.startsWith("/staff/go/")) return fallback;
  if (path === "/staff" || path.startsWith("/staff/")) return next;
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (role === "cashier") return fallback;
    const ownerOnly = path.startsWith("/admin/settings") || path.startsWith("/admin/staff");
    return ownerOnly && role !== "owner" ? fallback : next;
  }
  return fallback;
}

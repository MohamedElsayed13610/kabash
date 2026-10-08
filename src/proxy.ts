import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { timedFetch } from "./lib/timed-fetch";

/**
 * Keeps the Supabase session cookie fresh and sends signed-out visitors to the login page.
 * This is only the front door: every staff/admin page and API route ALSO checks the role on the server.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (process.env.SUPABASE_TIMING === "1") console.log(`[req] ${request.method} ${request.nextUrl.pathname}${request.headers.get("rsc") ? " (rsc)" : ""}`);

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isPage = pathname.startsWith("/staff") || pathname.startsWith("/admin");

  if (isPage && !data.user && pathname !== "/staff/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/staff/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = { matcher: ["/staff/:path*", "/admin/:path*", "/api/staff/:path*", "/api/admin/:path*"] };

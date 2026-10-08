/**
 * Opt-in timing for every Supabase round trip: start the server with SUPABASE_TIMING=1 and each call is logged as
 *   [sb] end=12345ms took=210ms GET /auth/v1/user
 * Off by default (one env check). Used to count and order the round trips behind a request.
 */
export const timedFetch: typeof fetch = async (input, init) => {
  if (process.env.SUPABASE_TIMING !== "1") return fetch(input, init);
  const start = performance.now();
  try {
    return await fetch(input, init);
  } finally {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw);
    console.log(`[sb] end=${Math.round(performance.now()) % 1_000_000}ms took=${Math.round(performance.now() - start)}ms ${init?.method ?? "GET"} ${u.pathname}${u.search.slice(0, 70)}`);
  }
};

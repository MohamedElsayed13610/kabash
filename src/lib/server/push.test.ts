import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

interface Sub { id: string; endpoint: string; p256dh: string; auth: string; failures: number; user_id: string }
let subs: Sub[] = [];
let activeUsers = new Set<string>();

/** Just enough of the Supabase query builder for push.ts. */
function fakeDb() {
  const builder = (table: string) => {
    let filters: [string, unknown][] = [];
    let op: "select" | "update" | "delete" = "select";
    let patch: Record<string, unknown> = {};
    const run = () => {
      if (table === "profiles") {
        const ids = (filters.find((f) => f[0] === "user_id")?.[1] as string[]) ?? [];
        return { data: ids.filter((i) => activeUsers.has(i)).map((user_id) => ({ user_id })), error: null };
      }
      const match = (s: Sub) => filters.every(([k, v]) => (s as unknown as Record<string, unknown>)[k] === v);
      if (op === "delete") subs = subs.filter((s) => !match(s));
      if (op === "update") subs = subs.map((s) => (match(s) ? { ...s, ...patch } : s));
      return { data: op === "select" ? subs.filter(match) : null, error: null };
    };
    const api: Record<string, unknown> = {
      select: () => api,
      update: (p: Record<string, unknown>) => ((op = "update"), (patch = p), api),
      delete: () => ((op = "delete"), api),
      eq: (k: string, v: unknown) => (filters.push([k, v]), api),
      in: (k: string, v: unknown[]) => (filters.push([k, v]), api),
      then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
    };
    return api;
  };
  return { from: builder };
}

vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => fakeDb() }));

const sub = (id: string, over: Partial<Sub> = {}): Sub => ({ id, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a", failures: 0, user_id: "u1", ...over });
const payload = { title: "طلب جديد", body: "x", url: "/staff" };

beforeEach(() => {
  vi.resetModules();
  sendNotification.mockReset();
  subs = [];
  activeUsers = new Set(["u1"]);
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

const load = async () => (await import("./push")).sendPush;

describe("sendPush", () => {
  it("sends to active staff devices and resets the failure counter", async () => {
    subs = [sub("a", { failures: 3 })];
    sendNotification.mockResolvedValue({});
    const r = await (await load())(payload);
    expect(r.sent).toBe(1);
    expect(subs[0].failures).toBe(0);
    expect(sendNotification.mock.calls[0][2]).toMatchObject({ urgency: "high", TTL: 3600 });
  });

  it.each([404, 410])("removes a dead subscription on %i", async (status) => {
    subs = [sub("dead"), sub("ok")];
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/dead")) throw Object.assign(new Error("gone"), { statusCode: status });
    });
    const r = await (await load())(payload);
    expect(r).toMatchObject({ sent: 1, removed: 1 });
    expect(subs.map((s) => s.id)).toEqual(["ok"]);
  });

  it("keeps a flaky device at first, then purges it after 5 failures in a row", async () => {
    subs = [sub("flaky")];
    sendNotification.mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 500 }));
    const send = await load();
    for (let i = 1; i <= 4; i++) {
      await send(payload);
      expect(subs[0].failures).toBe(i);
    }
    const r = await send(payload);
    expect(r.removed).toBe(1);
    expect(subs).toHaveLength(0);
  });

  it("skips devices of deactivated staff", async () => {
    subs = [sub("a", { user_id: "u1" }), sub("b", { user_id: "gone" })];
    sendNotification.mockResolvedValue({});
    const r = await (await load())(payload);
    expect(r.sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it("one failing device never stops the others", async () => {
    subs = [sub("bad"), sub("good1"), sub("good2")];
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint.endsWith("/bad")) throw new Error("network");
    });
    const r = await (await load())(payload);
    expect(r.sent).toBe(2);
    expect(r.failed).toBe(1);
  });

  it("without VAPID keys it does nothing and never throws", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    subs = [sub("a")];
    const r = await (await load())(payload);
    expect(r.skipped).toMatch(/VAPID/);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

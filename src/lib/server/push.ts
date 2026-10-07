import "server-only";
import webpush from "web-push";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const MAX_FAILURES = 5;
let configured = false;

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:owner@kabash.example", pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url: string;
  /** Same tag = replace the previous notification instead of stacking. */
  tag?: string;
}

interface Sub {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
}

/**
 * Sends to every active staff device (or just one user's devices when userId is given).
 * Dead subscriptions (404/410) are deleted at once; flaky ones are deleted after MAX_FAILURES in a row.
 * Never throws: a push problem must never break taking an order.
 */
export async function sendPush(payload: PushPayload, opts: { userId?: string } = {}) {
  const result = { sent: 0, removed: 0, failed: 0, skipped: "" };
  try {
    if (!configure()) return { ...result, skipped: "VAPID keys are not configured" };
    const db = createSupabaseAdmin();

    let q = db.from("push_subscriptions").select("id, endpoint, p256dh, auth, failures, user_id");
    if (opts.userId) q = q.eq("user_id", opts.userId);
    const { data, error } = await q;
    if (error) return { ...result, skipped: `db: ${error.message}` };

    // only devices of staff who are still active
    const userIds = [...new Set((data ?? []).map((s) => s.user_id))];
    const { data: active } = userIds.length
      ? await db.from("profiles").select("user_id").in("user_id", userIds).eq("active", true)
      : { data: [] as { user_id: string }[] };
    const activeSet = new Set((active ?? []).map((p) => p.user_id));
    const subs = (data ?? []).filter((s) => activeSet.has(s.user_id)) as (Sub & { user_id: string })[];

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
            TTL: 3600,
            urgency: "high",
          });
          result.sent++;
          await db.from("push_subscriptions").update({ failures: 0, last_success_at: new Date().toISOString() }).eq("id", s.id);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await db.from("push_subscriptions").delete().eq("id", s.id); // the device unsubscribed or uninstalled
            result.removed++;
          } else if (s.failures + 1 >= MAX_FAILURES) {
            await db.from("push_subscriptions").delete().eq("id", s.id);
            result.removed++;
          } else {
            await db.from("push_subscriptions").update({ failures: s.failures + 1 }).eq("id", s.id);
            result.failed++;
          }
        }
      }),
    );
  } catch (e) {
    console.error("[push]", e);
  }
  return result;
}

/** Called right after an order is saved. Contains no phone, address or name. */
export function newOrderPayload(o: { code: string; itemCount: number; total: number; fulfillment: "delivery" | "pickup"; hasButcher: boolean }): PushPayload {
  const kind = o.hasButcher ? "جزارة" : "مطعم";
  return {
    title: "طلب جديد في كباش",
    body: `#${o.code} · ${o.itemCount} صنف · ${Math.round(o.total * 100) / 100} ج.م · ${o.fulfillment === "delivery" ? "توصيل" : "استلام"} · ${kind}`,
    url: "/staff",
    tag: `order-${o.code}`, // one notification per order, so two orders at once don't overwrite each other
  };
}

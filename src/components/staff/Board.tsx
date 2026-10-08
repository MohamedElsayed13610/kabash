"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";
import { boardFilter, ORDER_SELECT, type BoardOrder } from "@/lib/staff-types";
import type { OrderStatus } from "@/lib/tracking-types";
import { OrderCard } from "./OrderCard";
import { CancelSheet, WeighSheet } from "./Sheets";
import { SummaryPanel } from "./SummaryPanel";
import { PushButton, registerStaffWorker, unsubscribeThisDevice } from "./PushButton";
import { useAlarm } from "./useAlarm";

type Tab = "new" | "active" | "way" | "done" | "cancelled" | "summary";
type Kind = "all" | "restaurant" | "butcher";

const TABS: { id: Tab; label: string; match: (s: OrderStatus) => boolean }[] = [
  { id: "new", label: "جديد", match: (s) => s === "new" },
  { id: "active", label: "بيتجهز", match: (s) => s === "accepted" || s === "preparing" },
  { id: "way", label: "في الطريق", match: (s) => s === "out_for_delivery" },
  { id: "done", label: "اتسلم", match: (s) => s === "delivered" },
  { id: "cancelled", label: "ملغي", match: (s) => s === "cancelled" },
];

const ROLE_LABEL = { owner: "المالك", manager: "المدير", cashier: "الكاشير" } as const;
const POLL_MS = 15_000;
const since24h = () => new Date(Date.now() - 24 * 3600_000).toISOString();

export function Board({
  initial,
  staff,
}: {
  initial: BoardOrder[];
  staff: { name: string; role: keyof typeof ROLE_LABEL };
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowser(), []);

  const [orders, setOrders] = useState<Map<string, BoardOrder>>(() => new Map(initial.map((o) => [o.id, o])));
  const [tab, setTab] = useState<Tab>("new");
  const [kind, setKind] = useState<Kind>("all");
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<BoardOrder | null>(null);
  const [weighing, setWeighing] = useState<BoardOrder | null>(null);

  const unacked = useMemo(() => [...orders.values()].filter((o) => o.status === "new" && !o.acknowledged_at), [orders]);
  const alarm = useAlarm(unacked.length > 0);

  const say = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 4500);
  }, []);

  /* ---------- data ---------- */
  const upsert = useCallback((o: BoardOrder) => setOrders((m) => new Map(m).set(o.id, o)), []);

  const fetchOne = useCallback(
    async (id: string) => {
      const { data } = await supabase.from("orders").select(ORDER_SELECT).eq("id", id).maybeSingle();
      if (data) upsert(data as unknown as BoardOrder);
    },
    [supabase, upsert],
  );

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from("orders").select(ORDER_SELECT).or(boardFilter(since24h()));
    if (error) return;
    setOrders(new Map((data as unknown as BoardOrder[]).map((o) => [o.id, o])));
  }, [supabase]);

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const scheduleFetch = useCallback(
    (id: string, delay = 120) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(id, setTimeout(() => void fetchOne(id), delay));
    },
    [fetchOne],
  );

  const markFresh = useCallback((id: string) => {
    setFresh((s) => new Set(s).add(id));
    setTimeout(() => setFresh((s) => (s.delete(id), new Set(s))), 8000);
  }, []);

  /* ---------- realtime + safety-net polling ---------- */
  useEffect(() => {
    const channel = supabase
      .channel("board")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (p) => {
        const id = (p.new as { id: string }).id;
        markFresh(id);
        scheduleFetch(id, 60);
        // the order row lands a moment before its items, so look again shortly after
        timers.current.set(id + ":later", setTimeout(() => void fetchOne(id), 900));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (p) => {
        scheduleFetch((p.new as { id: string }).id);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "orders" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setOrders((m) => (m.delete(id), new Map(m)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, (p) => {
        const id = ((p.new as { order_id?: string }).order_id ?? (p.old as { order_id?: string }).order_id) as string | undefined;
        if (id) scheduleFetch(id, 200);
      })
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") void fetchAll(); // catch up on anything missed while connecting
      });

    const poll = setInterval(() => !document.hidden && void fetchAll(), POLL_MS);
    const onVisible = () => !document.hidden && void fetchAll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onSw = (e: MessageEvent) => e.data?.type === "push" && void fetchAll();
    navigator.serviceWorker?.addEventListener("message", onSw);
    void registerStaffWorker();

    const t = timers.current;
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onSw);
      t.forEach(clearTimeout);
    };
  }, [supabase, fetchAll, fetchOne, scheduleFetch, markFresh]);

  /* ---------- keep the tablet awake once sound is on ---------- */
  useEffect(() => {
    if (!alarm.enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () => navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    void get();
    const onVis = () => !document.hidden && void get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release();
    };
  }, [alarm.enabled]);

  useEffect(() => {
    document.title = unacked.length > 0 ? `(${unacked.length}) طلب جديد | كباش` : "طلبات كباش";
  }, [unacked.length]);

  /* ---------- actions ---------- */
  async function call(o: BoardOrder, path: string, body?: unknown, okMsg?: string) {
    setBusyId(o.id);
    try {
      const res = await fetch(`/api/staff/orders/${o.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) say(j?.error?.message ?? "حصلت مشكلة. جرب تاني.");
      else if (okMsg) say(okMsg);
      await fetchOne(o.id);
      return res.ok;
    } catch {
      say("مفيش اتصال. اتأكد من الشبكة.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  const advance = (o: BoardOrder, to: OrderStatus) => void call(o, "status", { status: to });
  const mute = (o: BoardOrder) => void call(o, "ack");
  const muteAll = () => unacked.forEach((o) => void call(o, "ack"));

  async function logout() {
    await unsubscribeThisDevice(); // this device stops getting alerts once signed out
    await supabase.auth.signOut();
    router.replace("/staff/login");
  }

  /* ---------- view ---------- */
  const list = useMemo(() => {
    const t = TABS.find((x) => x.id === tab);
    if (!t) return [];
    const inKind = (o: BoardOrder) => kind === "all" || (kind === "restaurant" ? o.has_restaurant : o.has_butcher);
    const rows = [...orders.values()].filter((o) => t.match(o.status) && inKind(o));
    const finished = tab === "done" || tab === "cancelled";
    return rows.sort((a, b) => (finished ? +new Date(b.created_at) - +new Date(a.created_at) : +new Date(a.created_at) - +new Date(b.created_at)));
  }, [orders, tab, kind]);

  const count = (id: Tab) => {
    const t = TABS.find((x) => x.id === id)!;
    return [...orders.values()].filter((o) => t.match(o.status)).length;
  };

  return (
    <div className="min-h-dvh bg-ivory pb-24" data-alarm={alarm.enabled && unacked.length > 0 ? "ringing" : "idle"}>
      <header className="sticky top-0 z-30 bg-forest text-ivory">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Image src="/brand/logo.png" alt="" width={40} height={40} className="size-10" />
            <div className="leading-tight">
              <p className="font-display text-2xl">الطلبات</p>
              <p className="text-xs text-ivory/75">
                {staff.name} · {ROLE_LABEL[staff.role]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span data-testid="live" data-live={live} className={`flex items-center gap-1.5 text-sm ${live ? "text-leaf" : "text-saffron"}`}>
              <span className={`size-2.5 rounded-full ${live ? "bg-leaf" : "bg-saffron"}`} aria-hidden />
              {live ? "مباشر" : "بيتصل…"}
            </span>
            {staff.role !== "cashier" && (
              <Link href="/admin" data-testid="to-admin" className="grid h-11 place-items-center rounded-full bg-saffron px-4 text-sm font-bold text-charcoal">
                لوحة التحكم
              </Link>
            )}
            <button onClick={logout} className="h-11 rounded-full border border-leaf/50 px-4 text-sm">
              خروج
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-2 px-4 pb-3">
          {!alarm.enabled ? (
            <button
              data-testid="enable-sound"
              onClick={() => void alarm.enable()}
              className="h-14 w-full rounded-full bg-saffron font-display text-2xl text-charcoal"
            >
              تفعيل الصوت
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-leaf px-3 py-2 text-sm font-medium text-forest-deep">الصوت شغال</span>
              <button onClick={alarm.test} className="h-11 rounded-full border border-leaf/60 px-4 text-sm">
                جرّب الصوت
              </button>
            </div>
          )}
          <PushButton onMessage={say} />
        </div>

        {unacked.length > 0 && (
          <div role="alert" className="bg-ember px-4 py-3 text-ivory" data-testid="alarm-banner">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <p className="font-display text-2xl">
                {unacked.length === 1 ? "في طلب جديد!" : `في ${unacked.length} طلبات جديدة!`}
              </p>
              <button onClick={muteAll} className="h-11 rounded-full bg-ivory px-5 font-medium text-ember">
                كتم الصوت
              </button>
            </div>
            {!alarm.enabled && <p className="text-sm">فعّل الصوت من الزر الأصفر فوق عشان يرن.</p>}
          </div>
        )}

        <nav aria-label="حالات الطلبات" className="no-scrollbar mx-auto flex max-w-3xl gap-1 overflow-x-auto px-3 pb-2">
          {[...TABS, { id: "summary" as const, label: "ملخص اليوم" }].map((t) => {
            const on = tab === t.id;
            const n = t.id === "summary" ? 0 : count(t.id);
            return (
              <button
                key={t.id}
                data-tab={t.id}
                onClick={() => setTab(t.id)}
                aria-current={on ? "true" : undefined}
                className={`relative h-12 shrink-0 rounded-full px-5 font-medium ${on ? "bg-ivory text-forest" : "text-ivory"}`}
              >
                {t.label}
                {n > 0 && (
                  <span className={`ms-2 inline-grid min-w-6 place-items-center rounded-full px-1.5 text-sm ${t.id === "new" ? "bg-ember text-ivory" : "bg-ivory/25"}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        {tab === "summary" ? (
          <SummaryPanel />
        ) : (
          <>
            <div role="radiogroup" aria-label="نوع الطلب" className="flex gap-2">
              {(["all", "restaurant", "butcher"] as const).map((k) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={`h-11 rounded-full border-2 px-5 ${kind === k ? "border-forest bg-forest text-ivory" : "border-charcoal/20"}`}
                >
                  {k === "all" ? "الكل" : k === "restaurant" ? "مطعم" : "جزارة"}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4" aria-live="polite">
              {list.length === 0 && (
                <p className="py-16 text-center text-lg text-charcoal/60">
                  {tab === "new" ? "مفيش طلبات جديدة. أول ما يجي طلب هترن الصفحة." : "مفيش طلبات هنا."}
                </p>
              )}
              {list.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  now={now}
                  fresh={fresh.has(o.id)}
                  busy={busyId === o.id}
                  onAdvance={advance}
                  onMute={mute}
                  onCancel={setCancelling}
                  onWeigh={setWeighing}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-md rounded-2xl bg-charcoal p-4 text-center text-ivory shadow-lg">
          {toast}
        </div>
      )}

      <CancelSheet
        order={cancelling}
        onClose={() => setCancelling(null)}
        onConfirm={(o, reason) => {
          setCancelling(null);
          void call(o, "status", { status: "cancelled", reason });
        }}
      />
      <WeighSheet
        order={weighing}
        onClose={() => setWeighing(null)}
        onSave={async (o, lines) => {
          const ok = await call(o, "weigh", { lines }, "اتسجل الوزن");
          if (ok) setWeighing(null);
        }}
      />
    </div>
  );
}

"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "../ui/BottomSheet";

export interface ApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message: string; fields?: Record<string, string> };
}

interface ConfirmOpts {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface AdminApi {
  /** POST to /api/admin/<resource>. Shows an Arabic toast, refreshes server data on success. */
  post: <T = unknown>(resource: string, body: unknown, okMessage?: string) => Promise<ApiResult<T>>;
  say: (message: string) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  busy: boolean;
}

const Ctx = createContext<AdminApi | null>(null);
export const useAdmin = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside <AdminProvider>");
  return c;
};

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const [ask, setAsk] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);

  const post = useCallback<AdminApi["post"]>(
    async (resource, body, okMessage) => {
      setBusyCount((n) => n + 1);
      try {
        const res = await fetch(`/api/admin/${resource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const error = json?.error ?? { message: "حصلت مشكلة. جرب تاني." };
          if (res.status === 401) error.message = "الجلسة خلصت. سجّل دخولك تاني.";
          say(error.message, true);
          return { ok: false, error };
        }
        if (okMessage) say(okMessage);
        router.refresh();
        return { ok: true, data: json };
      } catch {
        const error = { message: "مفيش اتصال. اتأكد من الشبكة." };
        say(error.message, true);
        return { ok: false, error };
      } finally {
        setBusyCount((n) => n - 1);
      }
    },
    [router, say],
  );

  const confirm = useCallback<AdminApi["confirm"]>((o) => new Promise((resolve) => setAsk({ ...o, resolve })), []);
  const answer = (v: boolean) => {
    ask?.resolve(v);
    setAsk(null);
  };

  const value = useMemo(() => ({ post, say: (m: string) => say(m), confirm, busy: busyCount > 0 }), [post, say, confirm, busyCount]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-6 z-[70] mx-auto max-w-md rounded-2xl p-4 text-center font-medium shadow-lg ${
            toast.bad ? "bg-ember text-ivory" : "bg-charcoal text-ivory"
          }`}
        >
          {toast.text}
        </div>
      )}
      <BottomSheet open={!!ask} onClose={() => answer(false)} label={ask?.title ?? "تأكيد"}>
        {ask && (
          <div className="px-5 pb-4">
            <h2 className={`font-display text-3xl ${ask.danger ? "text-ember" : "text-forest"}`}>{ask.title}</h2>
            {ask.body && <p className="mt-2 text-lg text-charcoal/80">{ask.body}</p>}
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => answer(true)}
                className={`h-14 flex-1 rounded-full font-display text-2xl text-ivory ${ask.danger ? "bg-ember" : "bg-forest"}`}
              >
                {ask.confirmLabel ?? "تأكيد"}
              </button>
              <button onClick={() => answer(false)} className="h-14 rounded-full border-2 border-charcoal/30 px-6">
                رجوع
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </Ctx.Provider>
  );
}

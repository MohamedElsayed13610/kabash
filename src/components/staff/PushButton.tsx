"use client";

import { useCallback, useEffect, useState } from "react";

type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "busy";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export async function registerStaffWorker() {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/staff" });
}

/** Removes this device's push subscription (used on logout too). */
export async function unsubscribeThisDevice() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/staff");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await fetch("/api/staff/push/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
  } catch {
    /* best effort */
  }
}

export function PushButton({ onMessage }: { onMessage: (m: string) => void }) {
  const [state, setState] = useState<State>("checking");

  const detect = useCallback(async () => {
    if (isIOS() && !isStandalone()) return setState("ios-install");
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window) || !VAPID) {
      return setState("unsupported");
    }
    if (Notification.permission === "denied") return setState("denied");
    const reg = await registerStaffWorker();
    const sub = await reg?.pushManager.getSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  }, []);

  useEffect(() => {
    void detect();
  }, [detect]);

  async function enable() {
    setState("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      await registerStaffWorker();
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) }));
      const res = await fetch("/api/staff/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), userAgent: navigator.userAgent }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        await sub.unsubscribe();
        onMessage(j?.error?.message ?? "مقدرناش نفعّل الإشعارات.");
        return setState("off");
      }
      setState("on");
      onMessage("الإشعارات اشتغلت على الجهاز ده.");
    } catch (e) {
      onMessage(`مقدرناش نفعّل الإشعارات: ${(e as Error).message}`);
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    await unsubscribeThisDevice();
    setState("off");
  }

  async function test() {
    const res = await fetch("/api/staff/push/test", { method: "POST" });
    const j = await res.json().catch(() => null);
    onMessage(res.ok ? "بعتنا إشعار تجريبي. المفروض يظهر دلوقتي." : (j?.error?.message ?? "فشل الإشعار التجريبي."));
  }

  const base = "h-11 rounded-full px-4 text-sm font-medium";

  switch (state) {
    case "checking":
      return null;
    case "ios-install":
      return (
        <div role="note" className="rounded-xl bg-saffron/90 p-3 text-sm text-charcoal">
          <b>على الآيفون:</b> افتح الصفحة في Safari، اضغط زر المشاركة، ثم &quot;إضافة إلى الشاشة الرئيسية&quot;. افتح التطبيق من
          الأيقونة وبعدها هيظهر زر تفعيل الإشعارات.
        </div>
      );
    case "unsupported":
      return <p className="text-sm text-ivory/70">المتصفح ده مش بيدعم الإشعارات. جرب Chrome على أندرويد.</p>;
    case "denied":
      return (
        <p className="text-sm text-saffron">
          الإشعارات متقفلة من إعدادات المتصفح. افتح إعدادات الموقع واسمح بالإشعارات، وبعدين حدّث الصفحة.
        </p>
      );
    case "on":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-leaf px-3 py-2 text-sm font-medium text-forest-deep">الإشعارات شغالة</span>
          <button onClick={test} className={`${base} border border-leaf/60 text-ivory`}>
            جرّب الإشعار
          </button>
          <button onClick={disable} className={`${base} text-ivory/70 underline`}>
            إيقاف
          </button>
        </div>
      );
    default:
      return (
        <button onClick={enable} disabled={state === "busy"} className={`${base} bg-saffron text-charcoal disabled:opacity-60`}>
          تفعيل الإشعارات
        </button>
      );
  }
}

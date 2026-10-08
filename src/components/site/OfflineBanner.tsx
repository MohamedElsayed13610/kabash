"use client";

import { useEffect, useState } from "react";

/** Shown while the browser reports no connection. Cart and menu already on screen keep working. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      data-testid="offline-banner"
      className="fixed inset-x-0 top-0 z-[60] bg-charcoal px-4 py-2 text-center text-sm font-medium text-ivory"
    >
      النت قطع عندك. اللي قدامك شغال، وهنكمل أول ما يرجع.
    </div>
  );
}

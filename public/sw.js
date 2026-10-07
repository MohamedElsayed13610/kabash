/* Kabash staff service worker: shows new-order push notifications and wakes the open board. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "كباش", body: "", url: "/staff", tag: "kabash" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {
    /* non-JSON push: fall back to the defaults */
  }

  event.waitUntil(
    (async () => {
      // If the board is already open, tell it to refresh now (it will ring by itself).
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((c) => c.postMessage({ type: "push", tag: data.tag }));

      await self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        renotify: true,
        icon: "/staff-icons/icon-192.png",
        badge: "/staff-icons/badge-96.png",
        dir: "rtl",
        lang: "ar",
        vibrate: [300, 120, 300, 120, 600],
        requireInteraction: true,
        data: { url: data.url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/staff";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) {
        if (new URL(c.url).pathname.startsWith("/staff") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});

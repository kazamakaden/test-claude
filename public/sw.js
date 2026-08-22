// Task 5 web push opt-in — this file only receives and displays pushes; it
// does NOT send them (that pipeline is a later phase, see .env.example's
// VAPID comment). Deliberately has NO `fetch` handler and does no caching:
// a caching service worker is the single easiest way to break the App
// Router's RSC navigation (stale payloads served from a cache instead of
// fresh server responses) — do not add one without re-reading this note.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const title = typeof payload.title === "string" ? payload.title : "AFT UDONTECH";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : undefined,
      icon: "/brand/logo.png",
      data: { url: typeof payload.url === "string" ? payload.url : "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// Retire the old release's service worker for returning visitors.
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil((async () => {
  const cachesToDelete = (await caches.keys()).filter(name => name.startsWith("openwootility-upstream-"));
  await Promise.all(cachesToDelete.map(name => caches.delete(name)));
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type: "window" });
  await self.registration.unregister();
  await Promise.allSettled(windows.map(window => window.navigate(window.url)));
})()));

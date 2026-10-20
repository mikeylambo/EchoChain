// Retired service worker. The previous build cached everything cache-first, which would pin returning
// players to the old game forever. This version clears every cache, unregisters itself, and reloads open tabs
// so they fetch the current build from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const c of clients) c.navigate(c.url);
    })(),
  );
});

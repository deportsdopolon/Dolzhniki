const CACHE = "kvz-dolzhniki-v3.4";
const ASSETS = ["./", "./index.html", "./go.html", "./styles.css?v=3.4", "./app.js?v=3.4", "./manifest.json", "./icon.svg"];

async function putFresh(cache, url) {
  const res = await fetch(url, { cache: "reload" });
  if (!res.ok) throw new Error(url);
  await cache.put(url, res.clone());
}

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map((url) => putFresh(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await Promise.all(windows.map(async (client) => {
      if (typeof client.navigate !== "function") return;
      try { await client.navigate(client.url); } catch (_) {}
    }));
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (_) {
      const cached = await caches.match(req);
      if (cached) return cached;
      const url = new URL(req.url);
      if (url.pathname.endsWith("/")) {
        const index = await caches.match("./index.html");
        if (index) return index;
      }
      throw _;
    }
  })());
});

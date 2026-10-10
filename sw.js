const CACHE = "kvz-dolzhniki-v4";
const ASSETS = ["./", "./index.html", "./go.html", "./styles.css", "./app.js", "./manifest.json", "./icon.svg"];

async function putFresh(cache, url) {
  try {
    const res = await fetch(url, { cache: "reload" });
    if (res.ok && !res.redirected) await cache.put(url, res.clone());
  } catch (_) {}
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
      try { client.postMessage({ type: "RELOAD" }); } catch (_) {}
      if (typeof client.navigate !== "function") return;
      try { await client.navigate(client.url); } catch (_) {}
    }));
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/sw.js")) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req.url, { cache: "no-store" });
      if (res && res.ok && res.type === "basic" && !res.redirected) {
        cache.put(req.url, res.clone()).catch(() => {});
      }
      return res;
    } catch (_) {
      const cached = (await caches.match(req)) || (await caches.match(req.url));
      if (cached) return cached;
      if (url.pathname.endsWith("/")) {
        const index = await caches.match("./index.html");
        if (index) return index;
      }
      throw _;
    }
  })());
});

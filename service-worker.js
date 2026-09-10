const CACHE = "financial-tracker-v12";
const ASSETS = ["./", "./index.html", "./debts.html", "./tasks.html", "./savings.html", "./styles.css", "./app.js", "./debts.js", "./tasks.js", "./savings.js", "./cloud.js", "./firebase-config.js", "./manifest.json", "./icon.svg"];
self.addEventListener("install", event => { self.skipWaiting(); event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  // Permintaan Firebase/Google diuruskan sendiri oleh SDK — jangan cache di sini.
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match("./index.html"))));
});

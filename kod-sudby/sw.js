const CACHE_NAME = "kod-sudby-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/scenes/start-door.svg",
  "./assets/scenes/directions-banner.svg",
  "./assets/scenes/money-scene.svg",
  "./assets/scenes/relationships-scene.svg",
  "./assets/scenes/relationships-case-door.svg",
  "./assets/scenes/health-scene.svg",
  "./assets/scenes/family-scene.svg",
  "./assets/reference/relationships/00-evgeniy-hypnodetective.png",
  "./assets/reference/relationships/02-relationships-problem.png",
  "./assets/reference/relationships/03-relationships-profile.png",
  "./assets/reference/relationships/04-relationships-current-situation.png",
  "./assets/reference/relationships/05-relationships-goal-direction.png",
  "./assets/reference/relationships/06-relationships-result-benefit.png",
  "./assets/reference/relationships/07-relationships-why-now.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

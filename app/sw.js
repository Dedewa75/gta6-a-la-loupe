// Service worker : l'appli s'ouvre même sans réseau (dernières infos gardées en mémoire)
const VERSION = "appli-v1";
const COQUILLE = ["./", "index.html", "style.css", "app.js", "communaute.js", "firebase-config.js", "manifest.webmanifest", "icones/icone-192.png", "icones/icone-512.png", "../images/carte-leonida-rayonx.jpg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((l) => Promise.all(l.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // Firebase, YouTube… : jamais en cache
  // réseau d'abord (pour avoir les infos du jour), cache si hors ligne
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

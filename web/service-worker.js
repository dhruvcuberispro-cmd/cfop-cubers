"use strict";

const CACHE_NAME = "cfop-cubers-web-v4";
const BASE_URL = self.registration.scope;
const FILES_TO_CACHE = [
  new URL("./index.html", BASE_URL).href,
  new URL("./styles.css", BASE_URL).href,
  new URL("./app.js", BASE_URL).href,
  new URL("./manifest.webmanifest", BASE_URL).href,
  new URL("./cube-logo.png", BASE_URL).href,
  new URL("../algorithms.json", BASE_URL).href,
  new URL("../ALGORITHMS_LICENSE.txt", BASE_URL).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});

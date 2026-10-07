const CACHE_NAME = "motion-ai-classroom-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/app-icon.svg",
  "./vendor/vision_bundle.mjs",
  "./vendor/wasm/vision_wasm_internal.js",
  "./vendor/wasm/vision_wasm_internal.wasm",
  "./vendor/wasm/vision_wasm_module_internal.js",
  "./vendor/wasm/vision_wasm_module_internal.wasm",
  "./vendor/wasm/vision_wasm_nosimd_internal.js",
  "./vendor/wasm/vision_wasm_nosimd_internal.wasm",
  "./models/pose_landmarker_lite.task"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const pathname = new URL(request.url).pathname;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response; })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (/\.(?:html|css|js|mjs|webmanifest)$/.test(pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => { const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response; })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); return response;
    }))
  );
});

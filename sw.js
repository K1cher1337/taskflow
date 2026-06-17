// ─── Service Worker ───────────────────────────────────────────────────
// Bump CACHE_VER on every deploy that changes static files.
// The SW update notification in index.html will prompt users to reload.

const CACHE_VER  = "v1.0.0";
const SHELL_CACHE = `taskflow-shell-${CACHE_VER}`;
const CDN_CACHE   = `taskflow-cdn-${CACHE_VER}`;

// App shell files (served from GitHub Pages)
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/variables.css",
  "./css/themes.css",
  "./css/base.css",
  "./css/components.css",
  "./js/config.js",
  "./js/firebase.js",
  "./js/store.js",
  "./js/repo.js",
  "./js/rank.js",
  "./js/board.js",
  "./js/dnd.js",
  "./js/modals.js",
  "./js/toast.js",
  "./js/theme.js",
  "./js/io.js",
  "./js/main.js",
];

// CDN dependencies (cache-first forever — versioned URLs)
const CDN_FILES = [
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js",
  "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/+esm",
];

// ─── Install: precache everything ─────────────────────────────────────

self.addEventListener("install", event => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_FILES)),
      caches.open(CDN_CACHE).then(c =>
        Promise.allSettled(CDN_FILES.map(url => c.add(url)))
      ),
    ]).then(() => self.skipWaiting())
  );
});

// ─── Activate: clean old caches ───────────────────────────────────────

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== CDN_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategy ───────────────────────────────────────────────────
// • Firestore / googleapis.com traffic: network only (Firestore handles its own cache)
// • CDN files: cache-first
// • Everything else (shell): stale-while-revalidate

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Let Firestore & Auth pass through untouched
  if (url.includes("firestore.googleapis.com") ||
      url.includes("identitytoolkit.googleapis.com") ||
      url.includes("securetoken.googleapis.com")) {
    return;
  }

  // CDN: cache-first
  if (CDN_FILES.some(f => url.startsWith(f.split("?")[0]))) {
    event.respondWith(
      caches.open(CDN_CACHE).then(cache =>
        cache.match(event.request).then(cached =>
          cached || fetch(event.request).then(resp => {
            cache.put(event.request, resp.clone());
            return resp;
          })
        )
      )
    );
    return;
  }

  // Shell: stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(cache =>
      cache.match(event.request).then(cached => {
        const network = fetch(event.request).then(resp => {
          if (resp.ok) cache.put(event.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});

// ─── Skip waiting message ─────────────────────────────────────────────

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

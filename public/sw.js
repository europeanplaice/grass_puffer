const CACHE_NAME = '__CACHE_VERSION__'

function scopedUrl(path) {
  return new URL(path, self.registration.scope).toString()
}

const APP_SHELL = [
  scopedUrl('./'),
  scopedUrl('./index.html'),
  scopedUrl('./manifest.webmanifest'),
  scopedUrl('./favicon.svg'),
  scopedUrl('./icon.svg'),
  scopedUrl('./privacy.html'),
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)),
  )
  // Do NOT call skipWaiting() here — the page controls when to activate via postMessage.
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all([
        ...keys.map(key => (key === CACHE_NAME ? undefined : caches.delete(key))),
        caches.open(CACHE_NAME).then(cache =>
          cache.keys().then(requests =>
            Promise.all(
              requests
                .filter(req => new URL(req.url).pathname.startsWith('/api/'))
                .map(req => cache.delete(req)),
            ),
          ),
        ),
      ]),
    ),
  )
  // clients.claim() intentionally omitted — the page reloads itself after SKIP_WAITING,
  // so claiming existing clients is unnecessary and risks serving new assets to old JS.
})

self.addEventListener('fetch', event => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const scopePath = new URL(self.registration.scope).pathname
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith(`${scopePath}api/`)) return

  if (request.cache === 'no-store' || request.cache === 'reload' || request.cache === 'no-cache') {
    event.respondWith(fetch(request))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(scopedUrl('./'), copy))
          return response
        })
        .catch(() => caches.match(scopedUrl('./'))),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached && url.pathname.startsWith('/api/')) {
        caches.open(CACHE_NAME).then(cache => cache.delete(request))
        cached = undefined
      }
      if (cached) return cached

      return fetch(request).then(response => {
        if (response.ok) {
          const cacheControl = response.headers.get('Cache-Control') ?? ''
          if (cacheControl.toLowerCase().includes('no-store')) return response

          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

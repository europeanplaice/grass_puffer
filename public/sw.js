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
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => (key === CACHE_NAME ? undefined : caches.delete(key)))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

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
      if (cached) return cached

      return fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})

const VERSION = 'dev'
const CACHE = `mytracker-${VERSION}`

// Network-first: always try to fetch fresh, cache as fallback
async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || Response.error()
  }
}

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Only intercept same-origin requests (skip Supabase, fonts, CDN)
  if (url.origin !== self.location.origin) return
  e.respondWith(networkFirst(e.request))
})

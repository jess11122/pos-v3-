const CACHE = 'tabflow-v3'
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
]

// Cache static assets on install
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  )
})

// Clean old caches on activate
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Network-first for API calls, cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never cache Supabase, Anthropic, weather API, or POST requests
  if (
    url.hostname.includes('supabase') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('open-meteo') ||
    url.hostname.includes('stripe') ||
    e.request.method !== 'GET'
  ) {
    return e.respondWith(fetch(e.request))
  }

  // Cache-first for fonts and static assets
  if (url.pathname.match(/\.(woff2?|ttf|css|png|svg|ico)$/) || url.hostname.includes('fonts')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      }))
    )
    return
  }

  // Network-first for HTML/JS (always get latest app code)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

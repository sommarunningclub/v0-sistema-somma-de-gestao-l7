const CACHE_NAME = 'somma-v2.1.19-b'
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.log('[SW] Some assets failed to cache (this is okay):', err)
        return Promise.resolve()
      })
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => {
            console.log('[SW] Deleting old cache:', k)
            return caches.delete(k)
          })
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - Network First strategy with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip ALL API requests - always bypass SW and go straight to network
  // Never cache API responses, never serve from cache for API routes
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('asaas') ||
    url.pathname.includes('supabase') ||
    url.searchParams.has('action')
  ) {
    return // Let the browser handle it natively, no SW involvement
  }

  // Network First for everything else
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        // Cache valid responses
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache)
        })

        return response
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached
          }
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('/')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ cleared: true })
    })
  }
})


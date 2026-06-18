// JustDoIt Service Worker — push notifications + offline app-shell caching.

const CACHE = 'justdoit-v1'
const OFFLINE_URL = '/offline'
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Only cache successful, basic (same-origin) responses.
const cacheable = (res) => res && res.status === 200 && res.type === 'basic'

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never intercept cross-origin requests (e.g. Supabase REST/Auth/Realtime).
  if (url.origin !== self.location.origin) return

  // Navigations: network-first, fall back to cached page, then offline shell.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (cacheable(res)) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL))),
    )
    return
  }

  // Static assets: stale-while-revalidate.
  if (isStaticAsset(url)) {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (cacheable(res)) cache.put(request, res.clone())
            return res
          })
          .catch(() => cached)
        return cached || network
      }),
    )
  }
})

self.addEventListener('push', (e) => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'JustDoIt', body: e.data.text() } }

  const title = data.title ?? 'JustDoIt'
  const options = {
    body: data.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-96.png',
    data: { url: data.url ?? '/' },
    tag: data.tag ?? 'justdoit',
    renotify: true,
  }

  e.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    }),
  )
})

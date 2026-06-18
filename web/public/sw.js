// JustDoIt Service Worker — handles push notifications + PWA installability

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Minimal pass-through fetch handler. Its presence makes the app installable as
// a PWA; offline caching strategies will be layered on here (see ROADMAP: Offline Mode).
self.addEventListener('fetch', () => {})

self.addEventListener('push', e => {
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

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) { existing.focus(); existing.navigate(url) }
      else self.clients.openWindow(url)
    })
  )
})

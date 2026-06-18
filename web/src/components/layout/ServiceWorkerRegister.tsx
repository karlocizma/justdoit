'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker app-wide so the PWA is installable.
 * Push notifications also rely on this registration (see lib/push.ts),
 * which previously only ran when a user opted in from Settings.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registration is best-effort; the app works without it.
    })
  }, [])

  return null
}

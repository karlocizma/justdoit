'use client'

import { useEffect, useState } from 'react'

/**
 * Tracks browser connectivity. Starts optimistic (online) to avoid an
 * offline flash during SSR hydration, then reconciles on mount.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return online
}

/** Non-hook snapshot, safe to call from event handlers. */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}

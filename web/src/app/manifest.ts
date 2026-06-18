import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JustDoIt — Notes & Tasks',
    short_name: 'JustDoIt',
    description: 'Notes & Tasks, done right.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0f1117',
    theme_color: '#6c63ff',
    orientation: 'portrait-primary',
    categories: ['productivity', 'utilities'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

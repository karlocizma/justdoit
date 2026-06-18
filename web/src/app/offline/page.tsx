import s from './offline.module.css'

export const metadata = { title: 'Offline — JustDoIt' }

export default function OfflinePage() {
  return (
    <div className={s.root}>
      <div className={s.card}>
        <div className={s.icon} aria-hidden>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <h1 className={s.title}>You&rsquo;re offline</h1>
        <p className={s.body}>
          This page hasn&rsquo;t been saved for offline use yet. Pages you&rsquo;ve already visited
          stay available — reconnect to load everything else.
        </p>
        <a className={s.btn} href="/dashboard">Try again</a>
      </div>
    </div>
  )
}

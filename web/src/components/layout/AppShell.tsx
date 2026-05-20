'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CommandPalette } from './CommandPalette'

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const inInput = INPUT_TAGS.has((e.target as HTMLElement)?.tagName)

      // ⌘K / Ctrl+K — open command palette (works everywhere)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(p => !p)
        return
      }

      // Shortcuts below are suppressed when typing in an input
      if (inInput || e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case 'g':
          // g then d = go dashboard, g then n = go notes, etc.
          // handled by a simple one-key map for now
          break
        case 'n':
          e.preventDefault()
          router.push('/notes/new')
          break
        case '/':
          e.preventDefault()
          router.push('/search')
          break
        case '?':
          e.preventDefault()
          setPaletteOpen(true)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return (
    <>
      {children}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}

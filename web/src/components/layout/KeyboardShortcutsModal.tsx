'use client'

import { useEffect } from 'react'
import s from './KeyboardShortcutsModal.module.css'

const SHORTCUTS = [
  { group: 'Navigation', items: [
    { keys: ['N'], desc: 'New note' },
    { keys: ['/'], desc: 'Go to search' },
    { keys: ['⌘K', 'Ctrl+K'], desc: 'Command palette' },
    { keys: ['?'], desc: 'Keyboard shortcuts' },
  ]},
  { group: 'Note Editor', items: [
    { keys: ['F'], desc: 'Toggle focus mode' },
    { keys: ['Esc'], desc: 'Exit focus mode' },
  ]},
  { group: 'Text Formatting', items: [
    { keys: ['⌘B', 'Ctrl+B'], desc: 'Bold' },
    { keys: ['⌘I', 'Ctrl+I'], desc: 'Italic' },
    { keys: ['⌘K', 'Ctrl+K'], desc: 'Insert link' },
  ]},
]

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={s.overlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.header}>
          <h2 className={s.title}>Keyboard Shortcuts</h2>
          <button className={s.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={s.body}>
          {SHORTCUTS.map(group => (
            <div key={group.group} className={s.group}>
              <div className={s.groupLabel}>{group.group}</div>
              {group.items.map(item => (
                <div key={item.desc} className={s.row}>
                  <span className={s.desc}>{item.desc}</span>
                  <span className={s.keys}>
                    {item.keys.map(k => <kbd key={k} className={s.kbd}>{k}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

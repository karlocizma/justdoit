import { createClient } from '@/lib/supabase/server'

export const metadata = { title: 'Trash — JustDoIt' }

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, deleted_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(50)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--jd-fg)', marginBottom: 8 }}>Trash</h1>
      <p style={{ fontSize: 13, color: 'var(--jd-fg-dim)', marginBottom: 24 }}>
        Items are permanently deleted after 30 days.
      </p>
      {(notes ?? []).length === 0 && <p style={{ color: 'var(--jd-fg-dim)' }}>Trash is empty.</p>}
      {(notes ?? []).length > 0 && (
        <section>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: 'var(--jd-fg-dim)', marginBottom: 10 }}>
            Notes ({notes!.length})
          </div>
          {notes!.map(n => (
            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--jd-border-soft)' }}>
              <span style={{ fontSize: 14, color: 'var(--jd-fg-muted)' }}>{n.title || 'Untitled'}</span>
              <span style={{ fontSize: 12, color: 'var(--jd-fg-dim)' }}>
                {n.deleted_at ? new Date(n.deleted_at).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

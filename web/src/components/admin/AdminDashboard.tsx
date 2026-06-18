import s from './AdminDashboard.module.css'

export type AdminStats = {
  generated_at: string
  users: { total: number; new_last_7d: number }
  notes: { total: number; in_trash: number }
  tasks: { total: number; completed: number }
  workspaces: { total: number; active: number }
  recent_signups: { id: string; display_name: string | null; created_at: string }[]
}

export function AdminDashboard({ stats }: { stats: AdminStats }) {
  const completionRate = stats.tasks.total
    ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
    : 0

  return (
    <div className={s.root}>
      <header className={s.header}>
        <h1 className={s.title}>Admin</h1>
        <span className={s.generated}>
          Updated {new Date(stats.generated_at).toLocaleString()}
        </span>
      </header>

      <div className={s.grid}>
        <Stat label="Users" value={stats.users.total} sub={`+${stats.users.new_last_7d} in last 7 days`} />
        <Stat label="Notes" value={stats.notes.total} sub={`${stats.notes.in_trash} in trash`} />
        <Stat label="Tasks" value={stats.tasks.total} sub={`${stats.tasks.completed} completed · ${completionRate}%`} />
        <Stat label="Workspaces" value={stats.workspaces.total} sub={`${stats.workspaces.active} active`} />
      </div>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>Recent sign-ups</h2>
        {stats.recent_signups.length === 0 ? (
          <p className={s.empty}>No users yet.</p>
        ) : (
          <ul className={s.list}>
            {stats.recent_signups.map(u => (
              <li key={u.id} className={s.row}>
                <span className={s.name}>{u.display_name || 'Unnamed user'}</span>
                <span className={s.date}>{new Date(u.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className={s.card}>
      <span className={s.cardLabel}>{label}</span>
      <span className={s.cardValue}>{value.toLocaleString()}</span>
      <span className={s.cardSub}>{sub}</span>
    </div>
  )
}

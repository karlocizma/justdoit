/* global React */

const dashStyles = {
  root: { padding: "28px 32px", maxWidth: 1100, margin: "0 auto" },
  hello: { display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 },
  h1: { fontSize: 28, fontWeight: 700, color: "var(--jd-fg)", letterSpacing: "-0.01em" },
  date: { fontSize: 14, color: "var(--jd-fg-dim)" },
  sectionHead: {
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    marginTop: 28, marginBottom: 12,
  },
  h2: { fontSize: 17, fontWeight: 600, color: "var(--jd-fg)" },
  countMuted: { fontSize: 12, color: "var(--jd-fg-dim)" },
  noteGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
  },
  taskCard: {
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  taskListHead: {
    padding: "10px 16px",
    fontSize: 12, fontWeight: 600, color: "var(--jd-fg-muted)",
    letterSpacing: "0.04em", textTransform: "uppercase",
    background: "var(--jd-surface-2)",
    borderBottom: "1px solid var(--jd-border-soft)",
  },
  overdueHead: {
    color: "#e05c5c",
    background: "rgba(224,92,92,0.08)",
  },
  emptyHint: {
    padding: "20px 16px",
    fontSize: 13, color: "var(--jd-fg-dim)", textAlign: "center",
  },
};

function Dashboard({ notes, tasks, onOpenNote, onToggleTask, onOpenTask }) {
  const today = tasks.filter((t) => t.due === "today" && !t.done);
  const overdue = tasks.filter((t) => t.due && t.due.startsWith("-") && !t.done);
  const pinned = notes.filter((n) => n.pinned).slice(0, 4);

  return (
    <div style={dashStyles.root}>
      <div style={dashStyles.hello}>
        <h1 style={dashStyles.h1}>Today</h1>
        <span style={dashStyles.date}>Tuesday, May 19</span>
      </div>

      <div style={dashStyles.sectionHead}>
        <div style={dashStyles.h2}>Pinned notes</div>
        <span style={dashStyles.countMuted}>{pinned.length} pinned</span>
      </div>
      <div style={dashStyles.noteGrid}>
        {pinned.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}
      </div>

      <div style={dashStyles.sectionHead}>
        <div style={dashStyles.h2}>Today's tasks</div>
        <span style={dashStyles.countMuted}>{today.length} due today</span>
      </div>
      <div style={dashStyles.taskCard}>
        <div style={dashStyles.taskListHead}>Today · {today.length}</div>
        {today.length === 0 ? (
          <div style={dashStyles.emptyHint}>Nothing due today. Add a task below or enjoy a calm afternoon.</div>
        ) : today.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={onToggleTask} onOpen={onOpenTask} />
        ))}
      </div>

      {overdue.length > 0 && (
        <>
          <div style={dashStyles.sectionHead}>
            <div style={dashStyles.h2}>Overdue</div>
            <span style={{...dashStyles.countMuted, color: "#e05c5c"}}>{overdue.length} late</span>
          </div>
          <div style={dashStyles.taskCard}>
            <div style={{...dashStyles.taskListHead, ...dashStyles.overdueHead}}>Overdue · {overdue.length}</div>
            {overdue.map((t) => (
              <TaskRow key={t.id} task={t} onToggle={onToggleTask} onOpen={onOpenTask} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

window.Dashboard = Dashboard;

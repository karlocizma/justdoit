/* global React */

const tasksViewStyles = {
  root: { padding: "28px 32px", maxWidth: 900, margin: "0 auto" },
  head: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18 },
  listDot: (c) => ({ width: 10, height: 10, borderRadius: "50%", background: c }),
  h1: { fontSize: 28, fontWeight: 700, color: "var(--jd-fg)", letterSpacing: "-0.01em" },
  count: { fontSize: 14, color: "var(--jd-fg-dim)", marginLeft: 4 },
  addRow: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 16px",
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 12,
    marginBottom: 14,
  },
  addInput: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 14,
  },
  card: {
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  sectionHead: {
    padding: "10px 16px",
    fontSize: 12, fontWeight: 600,
    letterSpacing: "0.04em", textTransform: "uppercase",
    color: "var(--jd-fg-muted)",
    background: "var(--jd-surface-2)",
    borderBottom: "1px solid var(--jd-border-soft)",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  },
  empty: { padding: "32px 16px", textAlign: "center", color: "var(--jd-fg-dim)", fontSize: 13 },
};

function TasksView({ list, tasks, onToggleTask, onOpenTask, onAddTask }) {
  const [showCompleted, setShowCompleted] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const active = tasks.filter((t) => !t.done);
  const completed = tasks.filter((t) => t.done);

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddTask(draft.trim());
    setDraft("");
  };

  return (
    <div style={tasksViewStyles.root}>
      <div style={tasksViewStyles.head}>
        <span style={tasksViewStyles.listDot(list.color)} />
        <h1 style={tasksViewStyles.h1}>{list.title}</h1>
        <span style={tasksViewStyles.count}>{active.length} open · {completed.length} done</span>
      </div>

      <form style={tasksViewStyles.addRow} onSubmit={submit}>
        <IconPlus size={16} style={{ color: "var(--jd-fg-dim)" }} />
        <input
          style={tasksViewStyles.addInput}
          placeholder="Add a task — press Enter to save"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>

      <div style={tasksViewStyles.card}>
        <div style={tasksViewStyles.sectionHead}>
          <span>Active · {active.length}</span>
        </div>
        {active.length === 0 ? (
          <div style={tasksViewStyles.empty}>All clear. Take a break.</div>
        ) : active.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={onToggleTask} onOpen={onOpenTask} />
        ))}
      </div>

      {completed.length > 0 && (
        <div style={{ ...tasksViewStyles.card, marginTop: 14 }}>
          <div style={tasksViewStyles.sectionHead} onClick={() => setShowCompleted((v) => !v)}>
            <span>Completed · {completed.length}</span>
            <span style={{ color: "var(--jd-fg-dim)", display: "flex" }}>
              {showCompleted ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            </span>
          </div>
          {showCompleted && completed.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={onToggleTask} onOpen={onOpenTask} />
          ))}
        </div>
      )}
    </div>
  );
}

window.TasksView = TasksView;

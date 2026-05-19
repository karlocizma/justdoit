/* global React */

const PRIORITY_META = {
  0: { label: "None",   color: "#5a6088" },
  1: { label: "Low",    color: "#48d1cc" },
  2: { label: "Medium", color: "#f5a623" },
  3: { label: "High",   color: "#e05c5c" },
};

function dueLabel(due, today) {
  if (!due) return null;
  if (due === "today")    return { text: "Today",    color: "#7d75ff", bg: "rgba(108,99,255,0.14)" };
  if (due === "tomorrow") return { text: "Tomorrow", color: "#48d1cc", bg: "rgba(72,209,204,0.14)" };
  if (due.startsWith("-")) {
    const days = parseInt(due, 10);
    return { text: `Overdue · ${Math.abs(days)}d`, color: "#e05c5c", bg: "rgba(224,92,92,0.14)" };
  }
  return { text: due, color: "var(--jd-fg-muted)", bg: "var(--jd-surface-2)" };
}

const taskRowStyles = {
  row: (done) => ({
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 16px",
    borderBottom: "1px solid var(--jd-border-soft)",
    background: "transparent",
    cursor: "pointer",
    opacity: done ? 0.7 : 1,
    transition: "background 120ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  rowHover: { background: "var(--jd-surface-2)" },
  checkbox: (done) => ({
    width: 20, height: 20, borderRadius: 6,
    border: `1.5px solid ${done ? "#4caf89" : "var(--jd-fg-dim)"}`,
    background: done ? "#4caf89" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    cursor: "pointer",
    transition: "all 200ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  title: (done) => ({
    flex: 1, fontSize: 14,
    color: done ? "var(--jd-fg-faint)" : "var(--jd-fg)",
    textDecoration: done ? "line-through" : "none",
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  }),
  badge: (color, bg) => ({
    background: bg || `${color}1f`, color,
    borderRadius: 6, padding: "2px 8px",
    fontSize: 11, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 5,
    flexShrink: 0,
  }),
  prioDot: (c) => ({ width: 6, height: 6, borderRadius: "50%", background: c }),
  recurIcon: { color: "var(--jd-fg-dim)", display: "flex", flexShrink: 0 },
};

function TaskRow({ task, onToggle, onOpen }) {
  const [hover, setHover] = React.useState(false);
  const prio = PRIORITY_META[task.priority] || PRIORITY_META[0];
  const due = dueLabel(task.due);
  const baseStyle = taskRowStyles.row(task.done);
  const style = hover ? { ...baseStyle, ...taskRowStyles.rowHover } : baseStyle;
  return (
    <div
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen && onOpen(task)}
    >
      <div
        style={taskRowStyles.checkbox(task.done)}
        onClick={(e) => { e.stopPropagation(); onToggle && onToggle(task); }}
      >
        {task.done && <IconCheck size={12} strokeWidth={3.5} style={{ color: "#0f1117" }} />}
      </div>
      <div style={taskRowStyles.title(task.done)}>{task.title}</div>
      {task.priority > 0 && (
        <span style={taskRowStyles.badge(prio.color)}>
          <span style={taskRowStyles.prioDot(prio.color)} />
          {prio.label}
        </span>
      )}
      {due && (
        <span style={taskRowStyles.badge(due.color, due.bg)}>{due.text}</span>
      )}
      {task.recurring && (
        <span style={taskRowStyles.recurIcon} title="Repeats">
          <IconRepeat size={13} />
        </span>
      )}
    </div>
  );
}

window.TaskRow = TaskRow;
window.PRIORITY_META = PRIORITY_META;

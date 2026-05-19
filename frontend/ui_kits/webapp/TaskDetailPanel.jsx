/* global React */

const taskPanelStyles = {
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(15,17,23,0.6)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 50,
    animation: "jdFade 200ms cubic-bezier(0.2,0.8,0.2,1)",
  },
  panel: {
    position: "fixed", top: 0, right: 0, bottom: 0,
    width: 440,
    background: "var(--jd-surface)",
    borderLeft: "1px solid var(--jd-border)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    zIndex: 51,
    display: "flex", flexDirection: "column",
    animation: "jdSlideIn 260ms cubic-bezier(0.2,0.8,0.2,1)",
  },
  head: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 20px",
    borderBottom: "1px solid var(--jd-border-soft)",
  },
  headTitle: { fontSize: 13, fontWeight: 600, color: "var(--jd-fg-dim)",
               letterSpacing: "0.04em", textTransform: "uppercase" },
  closeBtn: { background: "transparent", border: "none", color: "var(--jd-fg-muted)",
              cursor: "pointer", padding: 4, display: "flex", borderRadius: 6 },
  body: { padding: "16px 20px", display: "flex", flexDirection: "column",
          gap: 16, overflowY: "auto", flex: 1 },
  titleRow: { display: "flex", alignItems: "flex-start", gap: 12 },
  checkbox: (done) => ({
    width: 22, height: 22, borderRadius: 6,
    border: `1.5px solid ${done ? "#4caf89" : "var(--jd-fg-dim)"}`,
    background: done ? "#4caf89" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, marginTop: 4, cursor: "pointer",
  }),
  titleInput: {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "var(--jd-fg)", fontFamily: "inherit",
    fontSize: 20, fontWeight: 600, lineHeight: 1.35,
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: 600, color: "var(--jd-fg-dim)",
                letterSpacing: "0.06em", textTransform: "uppercase" },
  fieldValue: {
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "9px 12px",
    color: "var(--jd-fg)", fontSize: 14,
    display: "flex", alignItems: "center", gap: 8,
    cursor: "pointer",
  },
  segWrap: {
    display: "flex", gap: 4, padding: 4,
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)", borderRadius: 8,
  },
  segItem: (active, color) => ({
    flex: 1, padding: "6px 10px",
    fontSize: 12, fontWeight: 600,
    color: active ? "var(--jd-fg)" : "var(--jd-fg-muted)",
    background: active ? "var(--jd-surface-2)" : "transparent",
    border: "none", borderRadius: 5,
    cursor: "pointer", fontFamily: "inherit",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  }),
  prioDot: (c) => ({ width: 6, height: 6, borderRadius: "50%", background: c }),
  recurRow: { display: "flex", gap: 8, alignItems: "center" },
  recurInput: {
    width: 60, background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 6, padding: "5px 8px",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 13, textAlign: "center",
    outline: "none",
  },
  notesArea: {
    width: "100%", minHeight: 90,
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "10px 12px",
    color: "var(--jd-fg)", fontFamily: "inherit",
    fontSize: 14, lineHeight: 1.55,
    outline: "none", resize: "vertical",
  },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? "#6c63ff" : "var(--jd-surface-3)",
    position: "relative", cursor: "pointer",
    transition: "background 200ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  thumb: (on) => ({
    position: "absolute", top: 2, left: on ? 18 : 2,
    width: 16, height: 16, borderRadius: "50%", background: "#fff",
    transition: "left 200ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  meta: {
    fontSize: 11, color: "var(--jd-fg-dim)",
    paddingTop: 12, borderTop: "1px solid var(--jd-border-soft)",
    display: "flex", flexDirection: "column", gap: 4,
  },
};

function Segmented({ value, options, onChange }) {
  return (
    <div style={taskPanelStyles.segWrap}>
      {options.map((o) => (
        <button
          key={o.value}
          style={taskPanelStyles.segItem(value === o.value, o.color)}
          onClick={() => onChange(o.value)}
        >
          {o.color && <span style={taskPanelStyles.prioDot(o.color)} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TaskDetailPanel({ task, onClose, onToggle, onChange }) {
  const [recurring, setRecurring] = React.useState(!!task.recurring);
  const [reminder, setReminder] = React.useState(!!task.reminder);
  const [subTasks, setSubTasks] = React.useState(task.subTasks || [
    { id: "s1", title: "Draft outline", done: true },
    { id: "s2", title: "Review with team", done: false },
  ]);
  const [newSubTask, setNewSubTask] = React.useState("");

  return (
    <>
      <div style={taskPanelStyles.backdrop} onClick={onClose} />
      <aside style={taskPanelStyles.panel}>
        <div style={taskPanelStyles.head}>
          <span style={taskPanelStyles.headTitle}>Task</span>
          <button style={taskPanelStyles.closeBtn} onClick={onClose}><IconClose size={16} /></button>
        </div>
        <div style={taskPanelStyles.body}>
          <div style={taskPanelStyles.titleRow}>
            <div
              style={taskPanelStyles.checkbox(task.done)}
              onClick={() => onToggle(task)}
            >
              {task.done && <IconCheck size={13} strokeWidth={3.5} style={{ color: "#0f1117" }} />}
            </div>
            <input
              style={taskPanelStyles.titleInput}
              defaultValue={task.title}
              placeholder="Task title"
            />
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={taskPanelStyles.fieldLabel}>Due</div>
            <div style={taskPanelStyles.fieldValue}>
              <IconCalendar size={14} style={{ color: "var(--jd-fg-dim)" }} />
              Today · 14:00
            </div>
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={taskPanelStyles.fieldLabel}>Priority</div>
            <Segmented
              value={task.priority || 0}
              onChange={() => {}}
              options={[
                { value: 0, label: "None" },
                { value: 1, label: "Low",    color: "#48d1cc" },
                { value: 2, label: "Medium", color: "#f5a623" },
                { value: 3, label: "High",   color: "#e05c5c" },
              ]}
            />
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={taskPanelStyles.fieldLabel}>Repeat</div>
              <div style={taskPanelStyles.toggle(recurring)} onClick={() => setRecurring((v) => !v)}>
                <div style={taskPanelStyles.thumb(recurring)} />
              </div>
            </div>
            {recurring && (
              <div style={taskPanelStyles.recurRow}>
                <span style={{ fontSize: 13, color: "var(--jd-fg-muted)" }}>Every</span>
                <input style={taskPanelStyles.recurInput} defaultValue="2" />
                <select style={{ ...taskPanelStyles.fieldValue, padding: "5px 10px", cursor: "pointer" }} defaultValue="weeks">
                  <option>days</option><option>weeks</option><option>months</option><option>years</option>
                </select>
              </div>
            )}
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={taskPanelStyles.fieldLabel}>Reminder</div>
              <div style={taskPanelStyles.toggle(reminder)} onClick={() => setReminder((v) => !v)}>
                <div style={taskPanelStyles.thumb(reminder)} />
              </div>
            </div>
            {reminder && (
              <>
                <div style={taskPanelStyles.fieldValue}>
                  <IconClock size={14} style={{ color: "var(--jd-fg-dim)" }} />
                  Today at 13:30
                </div>
                <Segmented
                  value="in_app"
                  onChange={() => {}}
                  options={[
                    { value: "in_app", label: "In-app" },
                    { value: "email",  label: "Email" },
                    { value: "push",   label: "Push" },
                  ]}
                />
              </>
            )}
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={taskPanelStyles.fieldLabel}>
              Sub-tasks
              <span style={{ marginLeft: 6, fontSize: 10, color: "var(--jd-fg-dim)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                {subTasks.filter((s) => s.done).length}/{subTasks.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
              {subTasks.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--jd-fg-faint)", display: "flex", flexShrink: 0 }}>
                    <IconCornerRight size={12} />
                  </span>
                  <div
                    style={{ ...taskPanelStyles.checkbox(s.done), width: 16, height: 16, borderRadius: 4, flexShrink: 0 }}
                    onClick={() => setSubTasks(subTasks.map((x) => x.id === s.id ? { ...x, done: !x.done } : x))}
                  >
                    {s.done && <IconCheck size={10} strokeWidth={3.5} style={{ color: "#0f1117" }} />}
                  </div>
                  <span style={{ fontSize: 13, color: s.done ? "var(--jd-fg-dim)" : "var(--jd-fg)", textDecoration: s.done ? "line-through" : "none", flex: 1 }}>
                    {s.title}
                  </span>
                  <button
                    style={{ background: "transparent", border: "none", color: "var(--jd-fg-faint)", cursor: "pointer", padding: 2, display: "flex", borderRadius: 4 }}
                    onClick={() => setSubTasks(subTasks.filter((x) => x.id !== s.id))}
                  >
                    <IconClose size={12} />
                  </button>
                </div>
              ))}
              <form
                style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newSubTask.trim()) return;
                  setSubTasks([...subTasks, { id: "s" + Date.now(), title: newSubTask.trim(), done: false }]);
                  setNewSubTask("");
                }}
              >
                <span style={{ color: "var(--jd-fg-faint)", display: "flex", flexShrink: 0 }}>
                  <IconCornerRight size={12} />
                </span>
                <input
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: "var(--jd-fg)", fontFamily: "inherit" }}
                  value={newSubTask}
                  onChange={(e) => setNewSubTask(e.target.value)}
                  placeholder="Add sub-task…"
                />
                {newSubTask && (
                  <button type="submit" style={{ background: "transparent", border: "none", color: "var(--jd-accent)", cursor: "pointer", padding: 2, display: "flex", borderRadius: 4, fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                    Add
                  </button>
                )}
              </form>
            </div>
          </div>

          <div style={taskPanelStyles.fieldGroup}>
            <div style={taskPanelStyles.fieldLabel}>Notes</div>
            <textarea
              style={taskPanelStyles.notesArea}
              defaultValue={task.notes || ""}
              placeholder="Add context for this task…"
            />
          </div>

          <div style={taskPanelStyles.meta}>
            <span>Created May 14, 2026</span>
            <span>Updated 2 hours ago</span>
          </div>
        </div>
      </aside>
    </>
  );
}

window.TaskDetailPanel = TaskDetailPanel;

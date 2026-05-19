/* global React */

const searchStyles = {
  root: { padding: "28px 32px", maxWidth: 860, margin: "0 auto" },
  head: { display: "flex", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "transparent", border: "none", color: "var(--jd-fg-muted)",
    cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0, flexShrink: 0,
  },
  queryWrap: { position: "relative", flex: 1 },
  queryInput: {
    width: "100%",
    background: "var(--jd-bg)", border: "1px solid var(--jd-accent)",
    borderRadius: 8, padding: "9px 12px 9px 36px",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 15,
    outline: "none", boxShadow: "0 0 0 3px rgba(108,99,255,0.14)",
  },
  queryIcon: {
    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
    color: "var(--jd-accent)", display: "flex",
  },
  kbd: {
    display: "inline-flex", alignItems: "center",
    background: "var(--jd-surface-2)", border: "1px solid var(--jd-border)",
    borderRadius: 5, padding: "2px 7px",
    fontSize: 11, fontWeight: 600, color: "var(--jd-fg-muted)",
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
  },
  meta: { fontSize: 13, color: "var(--jd-fg-dim)", marginBottom: 20 },

  section: { marginBottom: 28 },
  sectionHead: {
    fontSize: 11, fontWeight: 600, color: "var(--jd-fg-dim)",
    letterSpacing: "0.07em", textTransform: "uppercase",
    marginBottom: 10,
    display: "flex", alignItems: "center", gap: 10,
  },
  sectionLine: { flex: 1, height: 1, background: "var(--jd-border-soft)" },

  noteRow: {
    display: "flex", alignItems: "flex-start", gap: 14,
    padding: "12px 16px",
    background: "var(--jd-surface)", border: "1px solid var(--jd-border)",
    borderRadius: 10, marginBottom: 6,
    cursor: "pointer",
    transition: "border-color 200ms",
  },
  noteAccent: (c) => ({
    width: 3, borderRadius: 999, alignSelf: "stretch", flexShrink: 0,
    background: c || "var(--jd-border)",
    minHeight: 40,
  }),
  noteBody: { flex: 1, minWidth: 0 },
  noteTitle: { fontSize: 14, fontWeight: 600, color: "var(--jd-fg)", marginBottom: 3 },
  notePreview: {
    fontSize: 13, color: "var(--jd-fg-muted)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  noteTags: { display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" },
  tag: (c) => ({
    background: `${c}22`, color: c,
    borderRadius: 999, padding: "2px 8px",
    fontSize: 11, fontWeight: 600,
  }),
  noteTime: { fontSize: 11, color: "var(--jd-fg-dim)", flexShrink: 0, marginTop: 2 },

  taskRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 16px",
    background: "var(--jd-surface)", border: "1px solid var(--jd-border)",
    borderRadius: 10, marginBottom: 6,
    cursor: "pointer",
  },
  taskCheck: (done) => ({
    width: 18, height: 18, borderRadius: 5, flexShrink: 0,
    border: `1.5px solid ${done ? "#4caf89" : "var(--jd-fg-dim)"}`,
    background: done ? "#4caf89" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
  taskTitle: (done) => ({
    flex: 1, fontSize: 14, color: done ? "var(--jd-fg-dim)" : "var(--jd-fg)",
    textDecoration: done ? "line-through" : "none",
  }),
  taskList: { fontSize: 11, color: "var(--jd-fg-dim)", flexShrink: 0 },
  prioDot: (p) => {
    const c = p === 3 ? "#e05c5c" : p === 2 ? "#f5a623" : p === 1 ? "#48d1cc" : "transparent";
    return { width: 6, height: 6, borderRadius: "50%", background: c, flexShrink: 0 };
  },

  highlight: { background: "rgba(108,99,255,0.22)", color: "var(--jd-fg)", borderRadius: 2, padding: "0 2px" },

  empty: {
    background: "var(--jd-surface)", border: "1px solid var(--jd-border)",
    borderRadius: 12, padding: "48px 24px",
    textAlign: "center", color: "var(--jd-fg-dim)", fontSize: 13,
  },
  emptyIcon: { color: "var(--jd-fg-faint)", display: "flex", justifyContent: "center", marginBottom: 10 },
};

function Highlight({ text, query }) {
  if (!query) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark style={searchStyles.highlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
}

const MOCK_SEARCH_NOTES = [
  { id: "n1", title: "Q3 launch retrospective", color: "#8b7cff",
    preview: "Things that went well — fast iteration on the editor, RLS shipped without incident.",
    tags: [{ name: "work", color: "#48d1cc" }, { name: "retro", color: "#f5a623" }], timeAgo: "2h ago" },
  { id: "n4", title: "Backend plan — Supabase + Trigger.dev", color: "#4caf89",
    preview: "Use PostgREST for ~80% of the surface. Edge Functions only for aggregation.",
    tags: [{ name: "work", color: "#48d1cc" }, { name: "arch", color: "#4caf89" }], timeAgo: "1 week ago" },
];

const MOCK_SEARCH_TASKS = [
  { id: "tw1", title: "Review workspace invite UX", listName: "Work", priority: 3, done: false },
  { id: "tw2", title: "Reply to alice@ on RLS cascade behavior", listName: "Work", priority: 2, done: false },
  { id: "t4",  title: "Call mum — Sunday catch-up", listName: "Personal", priority: 2, done: false },
];

function SearchView({ query, onBack, onOpenNote, onOpenTask }) {
  const [value, setValue] = React.useState(query || "");
  const lc = value.trim().toLowerCase();

  const filteredNotes = lc.length > 0
    ? MOCK_SEARCH_NOTES.filter((n) =>
        n.title.toLowerCase().includes(lc) || n.preview.toLowerCase().includes(lc))
    : MOCK_SEARCH_NOTES;

  const filteredTasks = lc.length > 0
    ? MOCK_SEARCH_TASKS.filter((t) => t.title.toLowerCase().includes(lc))
    : MOCK_SEARCH_TASKS;

  const total = filteredNotes.length + filteredTasks.length;

  return (
    <div style={searchStyles.root}>
      <div style={searchStyles.head}>
        <button style={searchStyles.backBtn} onClick={onBack}>
          <IconChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> Back
        </button>
        <div style={searchStyles.queryWrap}>
          <div style={searchStyles.queryIcon}><IconSearch size={15} /></div>
          <input
            style={searchStyles.queryInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            placeholder="Search notes and tasks…"
          />
          <span style={searchStyles.kbd}>Esc</span>
        </div>
      </div>

      {lc.length > 0 && (
        <div style={searchStyles.meta}>
          {total === 0
            ? `No results for "${value}"`
            : `${total} result${total !== 1 ? "s" : ""} for "${value}"`}
        </div>
      )}

      {total === 0 && lc.length > 0 && (
        <div style={searchStyles.empty}>
          <div style={searchStyles.emptyIcon}><IconSearch size={32} /></div>
          Nothing matched. Try different keywords.
        </div>
      )}

      {filteredNotes.length > 0 && (
        <div style={searchStyles.section}>
          <div style={searchStyles.sectionHead}>
            <span>Notes</span>
            <span style={searchStyles.sectionLine} />
            <span>{filteredNotes.length}</span>
          </div>
          {filteredNotes.map((n) => (
            <div
              key={n.id}
              style={searchStyles.noteRow}
              onClick={() => onOpenNote && onOpenNote(n)}
            >
              <div style={searchStyles.noteAccent(n.color)} />
              <div style={searchStyles.noteBody}>
                <div style={searchStyles.noteTitle}>
                  <Highlight text={n.title} query={value} />
                </div>
                <div style={searchStyles.notePreview}>
                  <Highlight text={n.preview} query={value} />
                </div>
                {n.tags.length > 0 && (
                  <div style={searchStyles.noteTags}>
                    {n.tags.map((t) => (
                      <span key={t.name} style={searchStyles.tag(t.color)}>{t.name}</span>
                    ))}
                  </div>
                )}
              </div>
              <span style={searchStyles.noteTime}>{n.timeAgo}</span>
            </div>
          ))}
        </div>
      )}

      {filteredTasks.length > 0 && (
        <div style={searchStyles.section}>
          <div style={searchStyles.sectionHead}>
            <span>Tasks</span>
            <span style={searchStyles.sectionLine} />
            <span>{filteredTasks.length}</span>
          </div>
          {filteredTasks.map((t) => (
            <div
              key={t.id}
              style={searchStyles.taskRow}
              onClick={() => onOpenTask && onOpenTask(t)}
            >
              <div style={searchStyles.taskCheck(t.done)}>
                {t.done && <IconCheck size={11} strokeWidth={3.5} style={{ color: "#0f1117" }} />}
              </div>
              <span style={searchStyles.prioDot(t.priority)} />
              <span style={searchStyles.taskTitle(t.done)}>
                <Highlight text={t.title} query={value} />
              </span>
              <span style={searchStyles.taskList}>{t.listName}</span>
            </div>
          ))}
        </div>
      )}

      {lc.length === 0 && (
        <div style={searchStyles.empty}>
          <div style={searchStyles.emptyIcon}><IconSearch size={32} /></div>
          Start typing to search across your notes and tasks.
        </div>
      )}
    </div>
  );
}

window.SearchView = SearchView;

/* global React */

const notesViewStyles = {
  root: { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  h1: { fontSize: 28, fontWeight: 700, color: "var(--jd-fg)", letterSpacing: "-0.01em" },
  filters: { display: "flex", gap: 6, marginBottom: 18, padding: 4, background: "var(--jd-surface)", borderRadius: 8, border: "1px solid var(--jd-border)", width: "fit-content" },
  filter: (active) => ({
    padding: "5px 12px",
    fontSize: 13, fontWeight: 600,
    color: active ? "var(--jd-fg)" : "var(--jd-fg-muted)",
    background: active ? "var(--jd-surface-2)" : "transparent",
    border: "none", borderRadius: 6,
    cursor: "pointer", fontFamily: "inherit",
  }),
  newBtn: {
    background: "#6c63ff", color: "#fff",
    border: "none", borderRadius: 8, padding: "8px 14px",
    fontFamily: "inherit", fontSize: 13, fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
};

function NotesView({ notes, onOpenNote, onNewNote }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = notes.filter((n) => {
    if (filter === "pinned")   return n.pinned;
    if (filter === "archived") return n.archived;
    return !n.archived;
  });
  // Sort: pinned first
  filtered.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div style={notesViewStyles.root}>
      <div style={notesViewStyles.head}>
        <h1 style={notesViewStyles.h1}>Notes</h1>
        <button style={notesViewStyles.newBtn} onClick={onNewNote}>
          <IconPlus size={14} /> New note
        </button>
      </div>
      <div style={notesViewStyles.filters}>
        {[["all","All"],["pinned","Pinned"],["archived","Archived"]].map(([k, l]) => (
          <button key={k} style={notesViewStyles.filter(filter === k)} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <div style={notesViewStyles.grid}>
        {filtered.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}
      </div>
    </div>
  );
}

window.NotesView = NotesView;

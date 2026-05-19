/* global React */

const collectionStyles = {
  root: { padding: "28px 32px", maxWidth: 1200, margin: "0 auto" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  h1: { fontSize: 28, fontWeight: 700, color: "var(--jd-fg)", letterSpacing: "-0.01em" },
  sub: { fontSize: 13, color: "var(--jd-fg-dim)", marginTop: 4, marginBottom: 18 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 },
  empty: {
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 12,
    padding: "48px 16px",
    textAlign: "center",
    color: "var(--jd-fg-dim)", fontSize: 13,
  },
  emptyIcon: { color: "var(--jd-fg-faint)", display: "flex", justifyContent: "center", marginBottom: 8 },
  trashRow: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px",
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 10, marginBottom: 8,
  },
  trashTitle: { flex: 1, fontSize: 14, color: "var(--jd-fg)" },
  trashType: { fontSize: 11, color: "var(--jd-fg-dim)", textTransform: "uppercase", letterSpacing: "0.06em" },
  trashAction: {
    background: "transparent", color: "var(--jd-fg-muted)",
    border: "1px solid var(--jd-border)",
    borderRadius: 6, padding: "4px 10px",
    fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
};

function ArchiveView({ notes, onOpenNote }) {
  const archived = notes.filter((n) => n.archived);
  return (
    <div style={collectionStyles.root}>
      <h1 style={collectionStyles.h1}>Archive</h1>
      <div style={collectionStyles.sub}>Notes you've hidden from the main list. Restore from the editor.</div>
      {archived.length === 0 ? (
        <div style={collectionStyles.empty}>
          <div style={collectionStyles.emptyIcon}><IconArchive size={32} /></div>
          Nothing archived. Notes you archive will show up here.
        </div>
      ) : (
        <div style={collectionStyles.grid}>
          {archived.map((n) => <NoteCard key={n.id} note={n} onOpen={onOpenNote} />)}
        </div>
      )}
    </div>
  );
}

function TrashView({ items, onRestore }) {
  return (
    <div style={collectionStyles.root}>
      <h1 style={collectionStyles.h1}>Trash</h1>
      <div style={collectionStyles.sub}>Deleted notes and tasks. Items are permanently removed after 30 days.</div>
      {items.length === 0 ? (
        <div style={collectionStyles.empty}>
          <div style={collectionStyles.emptyIcon}><IconTrash size={32} /></div>
          Trash is empty.
        </div>
      ) : (
        items.map((it) => (
          <div key={it.id} style={collectionStyles.trashRow}>
            <span style={collectionStyles.trashType}>{it.type}</span>
            <div style={collectionStyles.trashTitle}>{it.title}</div>
            <span style={{ fontSize: 11, color: "var(--jd-fg-dim)" }}>{it.deletedAgo}</span>
            <button style={collectionStyles.trashAction} onClick={() => onRestore(it)}>Restore</button>
          </div>
        ))
      )}
    </div>
  );
}

window.ArchiveView = ArchiveView;
window.TrashView = TrashView;

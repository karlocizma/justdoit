/* global React */

const noteCardStyles = {
  card: (color) => ({
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderLeft: `3px solid ${color || "var(--jd-border)"}`,
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    cursor: "pointer",
    transition: "border-color 120ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  header: { display: "flex", alignItems: "center", gap: 6 },
  pin: { color: "#7d75ff", display: "flex" },
  title: { fontSize: 15, fontWeight: 600, color: "var(--jd-fg)",
           lineHeight: 1.3, flex: 1,
           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  body: { fontSize: 13, color: "var(--jd-fg-muted)", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden", minHeight: 60 },
  footer: { display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 2 },
  tags: { display: "flex", gap: 6, flexWrap: "wrap" },
  tag: (c) => ({
    background: `${c}22`, color: c,
    borderRadius: 999, padding: "2px 8px",
    fontSize: 11, fontWeight: 600, lineHeight: 1.3,
  }),
  ts: { fontSize: 11, color: "var(--jd-fg-dim)", flexShrink: 0 },
};

function NoteCard({ note, onOpen }) {
  const [hover, setHover] = React.useState(false);
  const style = {
    ...noteCardStyles.card(note.color),
    borderColor: hover ? "var(--jd-accent-soft)" : "var(--jd-border)",
    borderLeftColor: note.color || "var(--jd-border)",
  };
  return (
    <div
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen && onOpen(note)}
    >
      <div style={noteCardStyles.header}>
        {note.pinned && <span style={noteCardStyles.pin}><IconPin size={12} /></span>}
        <div style={noteCardStyles.title}>{note.title}</div>
      </div>
      <div style={noteCardStyles.body}>{note.preview}</div>
      <div style={noteCardStyles.footer}>
        <div style={noteCardStyles.tags}>
          {note.tags.map((t) => (
            <span key={t.name} style={noteCardStyles.tag(t.color)}>{t.name}</span>
          ))}
        </div>
        <span style={noteCardStyles.ts}>{note.timeAgo}</span>
      </div>
    </div>
  );
}

window.NoteCard = NoteCard;

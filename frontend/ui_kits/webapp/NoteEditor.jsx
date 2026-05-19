/* global React */

const editorStyles = {
  root: { display: "flex", height: "100%", maxWidth: 1100, margin: "0 auto", width: "100%" },
  main: { flex: 1, padding: "32px 40px", overflowY: "auto", minWidth: 0 },
  meta: { display: "flex", alignItems: "center", gap: 12, color: "var(--jd-fg-dim)", fontSize: 12, marginBottom: 16 },
  back: {
    display: "inline-flex", alignItems: "center", gap: 6,
    background: "transparent", border: "none", color: "var(--jd-fg-muted)",
    cursor: "pointer", fontFamily: "inherit", fontSize: 13, padding: 0,
  },
  saved: { display: "flex", alignItems: "center", gap: 4, marginLeft: "auto", color: "var(--jd-fg-dim)" },
  titleInput: {
    width: "100%", background: "transparent", border: "none", outline: "none",
    color: "var(--jd-fg)", fontFamily: "inherit",
    fontSize: 28, fontWeight: 700, letterSpacing: "-0.01em",
    lineHeight: 1.25, marginBottom: 8,
  },
  tagRow: { display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" },
  tag: (c) => ({
    background: `${c}22`, color: c,
    borderRadius: 999, padding: "3px 10px",
    fontSize: 12, fontWeight: 600,
  }),
  contentArea: {
    width: "100%", minHeight: 380,
    background: "transparent", border: "none", outline: "none",
    color: "var(--jd-fg)", fontFamily: "inherit",
    fontSize: 15, lineHeight: 1.7,
    resize: "none",
  },
  rail: {
    width: 260,
    borderLeft: "1px solid var(--jd-border-soft)",
    padding: "32px 24px",
    display: "flex", flexDirection: "column", gap: 20,
    flexShrink: 0,
    overflowY: "auto",
  },
  railLabel: { fontSize: 11, fontWeight: 600, color: "var(--jd-fg-dim)",
               letterSpacing: "0.06em", textTransform: "uppercase" },
  swatchRow: { display: "flex", gap: 6, flexWrap: "wrap" },
  swatch: (c, active) => ({
    width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
    border: active ? "2px solid var(--jd-fg)" : "2px solid transparent",
    boxShadow: active ? "0 0 0 1.5px var(--jd-bg) inset" : "none",
  }),
  pillToggle: (on) => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "8px 12px",
    background: on ? "var(--jd-accent-soft)" : "var(--jd-surface-2)",
    color: on ? "var(--jd-accent)" : "var(--jd-fg-muted)",
    border: "none", borderRadius: 8,
    fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
  }),
  attachZone: {
    border: "1px dashed var(--jd-border)",
    borderRadius: 8, padding: "14px",
    fontSize: 12, color: "var(--jd-fg-dim)", textAlign: "center",
  },
  metaItem: { fontSize: 12, color: "var(--jd-fg-dim)" },
};

const NOTE_COLORS = [null, "#475569","#8b7cff","#5b9bff","#48d1cc","#4caf89","#f5a623","#e05c8b","#e05c5c"];

function NoteEditor({ note, onBack, onChange }) {
  const [title, setTitle] = React.useState(note.title || "");
  const [content, setContent] = React.useState(note.preview || "");
  const [color, setColor] = React.useState(note.color);
  const [pinned, setPinned] = React.useState(note.pinned);

  return (
    <div style={editorStyles.root}>
      <div style={editorStyles.main}>
        <div style={editorStyles.meta}>
          <button style={editorStyles.back} onClick={onBack}>
            <IconChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> All notes
          </button>
          <span style={editorStyles.saved}>
            <IconCheck size={11} /> Saved
          </span>
        </div>
        <input
          style={editorStyles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          autoFocus={!note.title}
        />
        <div style={editorStyles.tagRow}>
          {(note.tags || []).map((t) => (
            <span key={t.name} style={editorStyles.tag(t.color)}>{t.name}</span>
          ))}
          <span style={{ ...editorStyles.tag("#7b82a8"), background: "var(--jd-surface-2)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconPlus size={11} /> Tag
          </span>
        </div>
        <textarea
          style={editorStyles.contentArea}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start writing… Markdown supported."
        />
      </div>

      <aside style={editorStyles.rail}>
        <div>
          <div style={editorStyles.railLabel}>Color</div>
          <div style={{ ...editorStyles.swatchRow, marginTop: 8 }}>
            {NOTE_COLORS.map((c) => (
              <button
                key={c || "none"}
                style={{
                  ...editorStyles.swatch(c || "transparent", color === c),
                  border: c
                    ? editorStyles.swatch(c, color === c).border
                    : "1.5px solid var(--jd-border)",
                }}
                onClick={() => setColor(c)}
                aria-label={c || "none"}
              />
            ))}
          </div>
        </div>

        <div>
          <div style={editorStyles.railLabel}>Status</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            <button style={editorStyles.pillToggle(pinned)} onClick={() => setPinned((v) => !v)}>
              <IconPin size={14} /> {pinned ? "Pinned" : "Pin to top"}
            </button>
            <button style={editorStyles.pillToggle(false)} onClick={() => {}}>
              <IconArchive size={14} /> Archive
            </button>
          </div>
        </div>

        <div>
          <div style={editorStyles.railLabel}>Reminder</div>
          <button style={{ ...editorStyles.pillToggle(false), marginTop: 8, width: "100%", justifyContent: "flex-start" }}>
            <IconClock size={14} /> Add reminder
          </button>
        </div>

        <div>
          <div style={editorStyles.railLabel}>Attachments</div>
          <div style={{ ...editorStyles.attachZone, marginTop: 8 }}>
            Drop a file here, or <span style={{ color: "var(--jd-accent)", cursor: "pointer" }}>browse</span>
            <div style={{ marginTop: 4, fontSize: 11 }}>Max 5 MB · images, PDF, text</div>
          </div>
        </div>

        <div style={{ ...editorStyles.metaItem, paddingTop: 12, borderTop: "1px solid var(--jd-border-soft)" }}>
          <div>Created May 14, 2026</div>
          <div>Updated just now</div>
        </div>
      </aside>
    </div>
  );
}

window.NoteEditor = NoteEditor;

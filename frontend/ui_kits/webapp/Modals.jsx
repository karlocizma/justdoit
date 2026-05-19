/* global React */

const modalStyles = {
  backdrop: {
    position: "fixed", inset: 0,
    background: "rgba(15,17,23,0.6)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    zIndex: 80,
    display: "flex", alignItems: "center", justifyContent: "center",
    animation: "jdFade 160ms cubic-bezier(0.2,0.8,0.2,1)",
  },
  card: {
    width: 380,
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 16,
    padding: "20px 22px 18px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    display: "flex", flexDirection: "column", gap: 14,
  },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: 700, color: "var(--jd-fg)" },
  closeBtn: {
    background: "transparent", border: "none", color: "var(--jd-fg-muted)",
    cursor: "pointer", padding: 4, display: "flex", borderRadius: 6,
  },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--jd-fg-muted)" },
  input: {
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "9px 12px",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 14, outline: "none",
  },
  swatchRow: { display: "flex", gap: 6 },
  swatch: (c, active) => ({
    width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer",
    border: active ? "2px solid var(--jd-fg)" : "2px solid transparent",
    boxShadow: active ? "0 0 0 1.5px var(--jd-bg) inset" : "none",
  }),
  actions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  btnGhost: {
    background: "transparent", color: "var(--jd-fg-muted)",
    border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "8px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  btnPrimary: {
    background: "#6c63ff", color: "#fff", border: "none",
    borderRadius: 8, padding: "8px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
};

function Modal({ title, children, onClose, footer }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div style={modalStyles.backdrop} onClick={onClose}>
      <div style={modalStyles.card} onClick={(e) => e.stopPropagation()}>
        <div style={modalStyles.head}>
          <div style={modalStyles.title}>{title}</div>
          <button style={modalStyles.closeBtn} onClick={onClose}><IconClose size={16} /></button>
        </div>
        {children}
        {footer && <div style={modalStyles.actions}>{footer}</div>}
      </div>
    </div>
  );
}

const LIST_COLORS = ["#8b7cff","#48d1cc","#5b9bff","#4caf89","#f5a623","#e05c8b","#e05c5c","#7b82a8"];

function NewListModal({ onClose, onCreate }) {
  const [title, setTitle] = React.useState("");
  const [color, setColor] = React.useState(LIST_COLORS[0]);
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ id: "list-" + Date.now(), title: title.trim(), color, openCount: 0 });
  };
  return (
    <Modal title="New list" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>List name</label>
          <input
            autoFocus
            style={modalStyles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Groceries, Reading, Side Project…"
          />
        </div>
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Color</label>
          <div style={modalStyles.swatchRow}>
            {LIST_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                style={modalStyles.swatch(c, color === c)}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div style={modalStyles.actions}>
          <button type="button" style={modalStyles.btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" style={modalStyles.btnPrimary}>Create list</button>
        </div>
      </form>
    </Modal>
  );
}

function NewWorkspaceModal({ onClose, onCreate }) {
  const [name, setName] = React.useState("");
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ id: "ws-" + Date.now(), name: name.trim(), initial: name.trim()[0].toUpperCase() });
  };
  return (
    <Modal title="New workspace" onClose={onClose}>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={modalStyles.field}>
          <label style={modalStyles.label}>Workspace name</label>
          <input
            autoFocus
            style={modalStyles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team Carbon, Side Project Inc…"
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--jd-fg-dim)", lineHeight: 1.5 }}>
          You'll be the owner. Invite people from <strong style={{ color: "var(--jd-fg-muted)" }}>Settings → Workspaces</strong> after creating.
        </div>
        <div style={modalStyles.actions}>
          <button type="button" style={modalStyles.btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" style={modalStyles.btnPrimary}>Create workspace</button>
        </div>
      </form>
    </Modal>
  );
}

window.Modal = Modal;
window.NewListModal = NewListModal;
window.NewWorkspaceModal = NewWorkspaceModal;
window.modalStyles = modalStyles;

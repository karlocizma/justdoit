/* global React */

// Generic popover anchored to a trigger element. Closes on outside click and Esc.
const popoverStyles = {
  surface: {
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 10,
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    padding: 6,
    minWidth: 200,
    fontSize: 13,
  },
  item: (variant) => ({
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    fontFamily: "inherit",
    fontSize: 13,
    color: variant === "danger" ? "#e05c5c" : "var(--jd-fg)",
    cursor: "pointer",
    textAlign: "left",
  }),
  divider: { height: 1, background: "var(--jd-border-soft)", margin: "4px 0" },
  meta: { padding: "8px 10px 4px", fontSize: 11, color: "var(--jd-fg-dim)" },
};

function useOutsideClose(ref, onClose) {
  React.useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
}

function Popover({ children, anchor, onClose, placement = "below-start" }) {
  const ref = React.useRef(null);
  useOutsideClose(ref, onClose);
  const rect = anchor?.getBoundingClientRect();
  if (!rect) return null;
  let style = { position: "fixed", zIndex: 100 };
  if (placement === "below-start") {
    style.top = rect.bottom + 6;
    style.left = rect.left;
  } else if (placement === "above-start") {
    style.bottom = window.innerHeight - rect.top + 6;
    style.left = rect.left;
  } else if (placement === "below-end") {
    style.top = rect.bottom + 6;
    style.right = window.innerWidth - rect.right;
  }
  return (
    <div ref={ref} style={{ ...style, ...popoverStyles.surface, animation: "jdFade 120ms cubic-bezier(0.2,0.8,0.2,1)" }}>
      {children}
    </div>
  );
}

function PopoverItem({ icon, children, onClick, variant, hint }) {
  const [hover, setHover] = React.useState(false);
  const style = {
    ...popoverStyles.item(variant),
    background: hover ? (variant === "danger" ? "rgba(224,92,92,0.12)" : "var(--jd-surface-2)") : "transparent",
  };
  return (
    <button
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {icon && <span style={{ color: variant === "danger" ? "#e05c5c" : "var(--jd-fg-dim)", display: "flex" }}>{icon}</span>}
      <span style={{ flex: 1 }}>{children}</span>
      {hint && <span style={{ color: "var(--jd-fg-dim)", fontSize: 11 }}>{hint}</span>}
    </button>
  );
}

window.Popover = Popover;
window.PopoverItem = PopoverItem;
window.popoverStyles = popoverStyles;

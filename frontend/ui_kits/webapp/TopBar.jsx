/* global React */

const topbarStyles = {
  root: {
    height: 56,
    background: "var(--jd-surface)",
    borderBottom: "1px solid var(--jd-border)",
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    gap: 14,
    flexShrink: 0,
  },
  searchWrap: {
    flex: 1,
    maxWidth: 560,
    margin: "0 auto",
    position: "relative",
  },
  searchInput: {
    width: "100%",
    background: "var(--jd-bg)",
    border: "1px solid var(--jd-border)",
    borderRadius: 8,
    padding: "8px 12px 8px 36px",
    color: "var(--jd-fg)",
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
  },
  searchIcon: {
    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
    color: "var(--jd-fg-dim)",
    display: "flex",
  },
  right: { display: "flex", alignItems: "center", gap: 14 },
  syncDot: (state) => ({
    width: 8, height: 8, borderRadius: "50%",
    background: state === "connected" ? "#4caf89" : "transparent",
    border: state === "connected" ? "none" : "1.5px solid #7b82a8",
    boxShadow: state === "connected" ? "0 0 0 3px rgba(76,175,137,0.18)" : "none",
  }),
  syncLabel: { fontSize: 12, color: "var(--jd-fg-dim)" },
  avatar: {
    width: 30, height: 30, borderRadius: "50%",
    background: "#6c63ff", color: "#0f1117",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 12,
    cursor: "pointer",
  },
};

function TopBar({ user, syncState = "connected", onNavigate, onGoSettings, onSignOut, onSearch }) {
  const [anchor, setAnchor] = React.useState(null);
  return (
    <header style={topbarStyles.root}>
      <div style={topbarStyles.searchWrap}>
        <div style={topbarStyles.searchIcon}><IconSearch size={15} /></div>
        <input
          style={topbarStyles.searchInput}
          placeholder="Search notes and tasks…"
          onFocus={() => onSearch && onSearch("")}
          onChange={(e) => onSearch && onSearch(e.target.value)}
        />
      </div>
      <div style={topbarStyles.right}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={topbarStyles.syncDot(syncState)} />
          <span style={topbarStyles.syncLabel}>
            {syncState === "connected" ? "Connected" : "Reconnecting…"}
          </span>
        </div>
        <div
          style={topbarStyles.avatar}
          title={user.email}
          onClick={(e) => setAnchor(e.currentTarget)}
        >{user.initial}</div>
      </div>
      {anchor && (
        <Popover anchor={anchor} onClose={() => setAnchor(null)} placement="below-end">
          <div style={popoverStyles.meta}>{user.email}</div>
          <PopoverItem icon={<IconSettings size={14} />} onClick={() => { setAnchor(null); onGoSettings("profile"); }}>Settings</PopoverItem>
          <PopoverItem icon={<IconArchive size={14} />} onClick={() => { setAnchor(null); onNavigate("archive"); }}>Archive</PopoverItem>
          <PopoverItem icon={<IconTrash size={14} />} onClick={() => { setAnchor(null); onNavigate("trash"); }}>Trash</PopoverItem>
          <div style={popoverStyles.divider} />
          <PopoverItem variant="danger" onClick={() => { setAnchor(null); onSignOut && onSignOut(); }}>Sign out</PopoverItem>
        </Popover>
      )}
    </header>
  );
}

window.TopBar = TopBar;

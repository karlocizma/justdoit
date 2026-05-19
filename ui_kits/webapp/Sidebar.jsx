/* global React */

const sidebarStyles = {
  root: {
    width: 260,
    background: "var(--jd-surface)",
    borderRight: "1px solid var(--jd-border)",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    height: "100%",
    overflow: "hidden",
  },
  brand: {
    padding: "16px 20px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid var(--jd-border-soft)",
  },
  wsSwitcher: {
    margin: 12,
    padding: "10px 12px",
    borderRadius: 8,
    background: "var(--jd-surface-2)",
    border: "1px solid var(--jd-border)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
  },
  wsAvatar: {
    width: 26, height: 26, borderRadius: 6,
    background: "linear-gradient(135deg,#6c63ff,#48d1cc)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#0f1117", fontWeight: 700, fontSize: 12,
  },
  wsName: { flex: 1, fontSize: 13, fontWeight: 600, color: "var(--jd-fg)" },
  wsChevron: { color: "var(--jd-fg-dim)", display: "flex" },

  section: { padding: "8px 12px 4px 20px", fontSize: 11, fontWeight: 600,
             letterSpacing: "0.06em", textTransform: "uppercase",
             color: "var(--jd-fg-dim)" },

  navList: { display: "flex", flexDirection: "column", padding: "0 8px" },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px",
    margin: "1px 0",
    borderRadius: 6,
    fontSize: 14, fontWeight: 500,
    color: active ? "var(--jd-fg)" : "var(--jd-fg-muted)",
    background: active ? "var(--jd-accent-soft)" : "transparent",
    cursor: "pointer", border: "none", width: "100%",
    textAlign: "left", fontFamily: "inherit",
  }),
  navIcon: (active) => ({
    color: active ? "var(--jd-accent)" : "var(--jd-fg-dim)",
    flexShrink: 0, display: "flex",
  }),
  navLabel: { flex: 1 },
  navCount: { fontSize: 11, color: "var(--jd-fg-dim)", fontVariantNumeric: "tabular-nums" },
  navColor: (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }),

  footer: {
    marginTop: "auto",
    padding: 12,
    borderTop: "1px solid var(--jd-border-soft)",
    display: "flex", gap: 10, alignItems: "center",
  },
  footerAvatar: {
    width: 28, height: 28, borderRadius: "50%",
    background: "#6c63ff",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#0f1117", fontWeight: 700, fontSize: 12,
  },
  footerName: { fontSize: 13, color: "var(--jd-fg)" },
  footerEmail: { fontSize: 11, color: "var(--jd-fg-dim)" },
};

function Sidebar({
  active, onNavigate, lists, workspace, workspaces, activeWorkspace, onSwitchWorkspace,
  user, onSignOut, onGoSettings, onNewList, onNewWorkspace,
}) {
  const [wsAnchor, setWsAnchor] = React.useState(null);
  const [userAnchor, setUserAnchor] = React.useState(null);

  return (
    <aside style={sidebarStyles.root}>
      <div style={sidebarStyles.brand}>
        <Brand size={28} />
      </div>

      <div
        style={sidebarStyles.wsSwitcher}
        onClick={(e) => setWsAnchor(e.currentTarget)}
      >
        <div style={sidebarStyles.wsAvatar}>{workspace.initial}</div>
        <div style={sidebarStyles.wsName}>{workspace.name}</div>
        <div style={sidebarStyles.wsChevron}><IconChevronDown size={14} /></div>
      </div>

      <div style={sidebarStyles.navList}>
        <button style={sidebarStyles.navItem(active === "dashboard")} onClick={() => onNavigate("dashboard")}>
          <span style={sidebarStyles.navIcon(active === "dashboard")}><IconHome size={16} /></span>
          <span style={sidebarStyles.navLabel}>Today</span>
        </button>
        <button style={sidebarStyles.navItem(active === "notes" || active === "editor")} onClick={() => onNavigate("notes")}>
          <span style={sidebarStyles.navIcon(active === "notes" || active === "editor")}><IconNote size={16} /></span>
          <span style={sidebarStyles.navLabel}>Notes</span>
          <span style={sidebarStyles.navCount}>12</span>
        </button>
      </div>

      <div style={sidebarStyles.section}>Lists</div>
      <div style={sidebarStyles.navList}>
        {lists.map((l) => {
          const id = "list:" + l.id;
          const isActive = active === id;
          return (
            <button key={l.id} style={sidebarStyles.navItem(isActive)} onClick={() => onNavigate(id)}>
              <span style={sidebarStyles.navColor(l.color)} />
              <span style={sidebarStyles.navLabel}>{l.title}</span>
              <span style={sidebarStyles.navCount}>{l.openCount}</span>
            </button>
          );
        })}
        <button style={sidebarStyles.navItem(false)} onClick={onNewList}>
          <span style={sidebarStyles.navIcon(false)}><IconPlus size={14} /></span>
          <span style={{ ...sidebarStyles.navLabel, color: "var(--jd-fg-dim)" }}>New list</span>
        </button>
      </div>

      <div style={sidebarStyles.navList}>
        <button style={sidebarStyles.navItem(active === "archive")} onClick={() => onNavigate("archive")}>
          <span style={sidebarStyles.navIcon(active === "archive")}><IconArchive size={16} /></span>
          <span style={sidebarStyles.navLabel}>Archive</span>
        </button>
        <button style={sidebarStyles.navItem(active === "trash")} onClick={() => onNavigate("trash")}>
          <span style={sidebarStyles.navIcon(active === "trash")}><IconTrash size={16} /></span>
          <span style={sidebarStyles.navLabel}>Trash</span>
        </button>
        <button style={sidebarStyles.navItem(active === "settings")} onClick={() => onGoSettings("profile")}>
          <span style={sidebarStyles.navIcon(active === "settings")}><IconSettings size={16} /></span>
          <span style={sidebarStyles.navLabel}>Settings</span>
        </button>
      </div>

      <div
        style={{ ...sidebarStyles.footer, cursor: "pointer" }}
        onClick={(e) => setUserAnchor(e.currentTarget)}
      >
        <div style={sidebarStyles.footerAvatar}>{user.initial}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={sidebarStyles.footerName}>{user.name}</div>
          <div style={sidebarStyles.footerEmail}>{user.email}</div>
        </div>
        <span style={{ color: "var(--jd-fg-dim)", display: "flex" }}><IconChevronDown size={14} /></span>
      </div>

      {wsAnchor && (
        <Popover anchor={wsAnchor} onClose={() => setWsAnchor(null)} placement="below-start">
          <div style={popoverStyles.meta}>Switch workspace</div>
          {workspaces.map((w) => (
            <PopoverItem
              key={w.id}
              icon={
                <span style={{
                  width: 18, height: 18, borderRadius: 4,
                  background: w.id === "personal-ws"
                    ? "linear-gradient(135deg,#6c63ff,#48d1cc)"
                    : w.id === "team-carbon" ? "#48d1cc" : "#f5a623",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  color: "#0f1117", fontWeight: 700, fontSize: 10,
                }}>{w.initial}</span>
              }
              onClick={() => { onSwitchWorkspace(w.id); setWsAnchor(null); }}
              hint={w.id === activeWorkspace ? "•" : undefined}
            >
              {w.name}
            </PopoverItem>
          ))}
          <div style={popoverStyles.divider} />
          <PopoverItem icon={<IconPlus size={14} />} onClick={() => { setWsAnchor(null); onNewWorkspace(); }}>New workspace</PopoverItem>
          <PopoverItem icon={<IconSettings size={14} />} onClick={() => { setWsAnchor(null); onGoSettings("workspaces"); }}>Workspace settings</PopoverItem>
        </Popover>
      )}

      {userAnchor && (
        <Popover anchor={userAnchor} onClose={() => setUserAnchor(null)} placement="above-start">
          <div style={popoverStyles.meta}>{user.email}</div>
          <PopoverItem icon={<IconSettings size={14} />} onClick={() => { setUserAnchor(null); onGoSettings("profile"); }}>Settings</PopoverItem>
          <PopoverItem icon={<IconArchive size={14} />} onClick={() => { setUserAnchor(null); onNavigate("archive"); }}>Archive</PopoverItem>
          <PopoverItem icon={<IconTrash size={14} />} onClick={() => { setUserAnchor(null); onNavigate("trash"); }}>Trash</PopoverItem>
          <div style={popoverStyles.divider} />
          <PopoverItem variant="danger" onClick={() => { setUserAnchor(null); onSignOut && onSignOut(); }}>Sign out</PopoverItem>
        </Popover>
      )}
    </aside>
  );
}

window.Sidebar = Sidebar;

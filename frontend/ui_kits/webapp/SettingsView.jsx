/* global React */

const settingsStyles = {
  root: { display: "flex", height: "100%", maxWidth: 1000, margin: "0 auto", width: "100%" },
  nav: { width: 220, padding: "28px 12px 28px 24px", flexShrink: 0, borderRight: "1px solid var(--jd-border-soft)" },
  navTitle: { fontSize: 13, fontWeight: 600, color: "var(--jd-fg-dim)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 10px 8px" },
  navItem: (active) => ({
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 12px",
    margin: "1px 0",
    borderRadius: 6,
    fontSize: 13, fontWeight: 500,
    color: active ? "var(--jd-fg)" : "var(--jd-fg-muted)",
    background: active ? "var(--jd-surface-2)" : "transparent",
    cursor: "pointer", border: "none", width: "100%", textAlign: "left",
    fontFamily: "inherit",
  }),
  content: { flex: 1, padding: "28px 32px", overflowY: "auto" },
  h1: { fontSize: 24, fontWeight: 700, color: "var(--jd-fg)", marginBottom: 6, letterSpacing: "-0.01em" },
  sub: { fontSize: 13, color: "var(--jd-fg-dim)", marginBottom: 24 },
  section: { background: "var(--jd-surface)", border: "1px solid var(--jd-border)", borderRadius: 12, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "var(--jd-fg)", marginBottom: 14, letterSpacing: "0.02em" },
  field: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--jd-fg-muted)" },
  input: {
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "9px 12px",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 14, outline: "none",
  },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--jd-border-soft)" },
  rowLast: { borderBottom: "none" },
  rowMain: { fontSize: 14, color: "var(--jd-fg)" },
  rowMeta: { fontSize: 12, color: "var(--jd-fg-dim)", marginTop: 2 },
  toggle: (on) => ({
    width: 36, height: 20, borderRadius: 999,
    background: on ? "#6c63ff" : "var(--jd-surface-3)",
    position: "relative", cursor: "pointer",
    transition: "background 200ms cubic-bezier(0.2,0.8,0.2,1)",
    flexShrink: 0,
  }),
  thumb: (on) => ({
    position: "absolute", top: 2, left: on ? 18 : 2,
    width: 16, height: 16, borderRadius: "50%", background: "#fff",
    transition: "left 200ms cubic-bezier(0.2,0.8,0.2,1)",
  }),
  saveRow: { display: "flex", justifyContent: "flex-end", gap: 8 },
  btnPrimary: {
    background: "#6c63ff", color: "#fff", border: "none",
    borderRadius: 8, padding: "9px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  btnGhost: {
    background: "transparent", color: "var(--jd-fg-muted)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "9px 16px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  btnDanger: {
    background: "rgba(224,92,92,0.14)", color: "#e05c5c", border: "none",
    borderRadius: 8, padding: "9px 14px",
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  swatchRow: { display: "flex", gap: 8 },
  swatch: (color, active) => ({
    width: 28, height: 28, borderRadius: 8, background: color,
    cursor: "pointer", border: active ? "2px solid var(--jd-fg)" : "2px solid transparent",
    boxShadow: active ? "0 0 0 2px var(--jd-bg) inset" : "none",
  }),
  themeRow: { display: "flex", gap: 8, padding: 4, background: "var(--jd-bg)", border: "1px solid var(--jd-border)", borderRadius: 8, width: "fit-content" },
  themeBtn: (active) => ({
    padding: "6px 14px", fontSize: 13, fontWeight: 600,
    color: active ? "var(--jd-fg)" : "var(--jd-fg-muted)",
    background: active ? "var(--jd-surface-2)" : "transparent",
    border: "none", borderRadius: 5, cursor: "pointer", fontFamily: "inherit",
  }),
  memberRow: { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--jd-border-soft)" },
  memberAvatar: (bg) => ({
    width: 32, height: 32, borderRadius: "50%", background: bg,
    color: "#0f1117", fontWeight: 700, fontSize: 12,
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  }),
  memberName: { fontSize: 14, color: "var(--jd-fg)", fontWeight: 500 },
  memberEmail: { fontSize: 12, color: "var(--jd-fg-dim)" },
  rolePill: (role) => {
    const map = { owner: "#6c63ff", admin: "#48d1cc", member: "#7b82a8", pending: "#f5a623" };
    const c = map[role] || map.member;
    return { background: `${c}22`, color: c, borderRadius: 999, padding: "2px 8px", fontSize: 11, fontWeight: 600, textTransform: "capitalize" };
  },
};

const ACCENT_OPTIONS = ["#6c63ff", "#48d1cc", "#4caf89", "#f5a623", "#e05c5c", "#e05c8b"];

function Settings({ user, initialSection }) {
  const [section, setSection] = React.useState(initialSection || "profile");
  const [digest, setDigest] = React.useState(true);
  const [inApp, setInApp] = React.useState(true);
  const [theme, setTheme] = React.useState("dark");
  const [accent, setAccent] = React.useState("#6c63ff");

  return (
    <div style={settingsStyles.root}>
      <aside style={settingsStyles.nav}>
        <div style={settingsStyles.navTitle}>Settings</div>
        {[
          ["profile",      "Profile"],
          ["appearance",   "Appearance"],
          ["notifications","Notifications"],
          ["workspaces",   "Workspaces"],
          ["export",       "Export"],
          ["account",      "Account"],
        ].map(([k, l]) => (
          <button key={k} style={settingsStyles.navItem(section === k)} onClick={() => setSection(k)}>{l}</button>
        ))}
      </aside>

      <div style={settingsStyles.content}>
        {section === "profile" && (
          <>
            <h1 style={settingsStyles.h1}>Profile</h1>
            <p style={settingsStyles.sub}>How you appear across JustDoIt.</p>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.field}>
                <label style={settingsStyles.label}>Display name</label>
                <input style={settingsStyles.input} defaultValue={user.name} />
              </div>
              <div style={settingsStyles.field}>
                <label style={settingsStyles.label}>Email</label>
                <input style={{ ...settingsStyles.input, color: "var(--jd-fg-dim)" }} value={user.email} disabled />
              </div>
              <div style={settingsStyles.field}>
                <label style={settingsStyles.label}>Avatar URL</label>
                <input style={settingsStyles.input} placeholder="https://…" />
              </div>
              <div style={settingsStyles.saveRow}>
                <button style={settingsStyles.btnPrimary}>Save</button>
              </div>
            </div>
          </>
        )}

        {section === "appearance" && (
          <>
            <h1 style={settingsStyles.h1}>Appearance</h1>
            <p style={settingsStyles.sub}>Theme and accent color. Changes are saved instantly.</p>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.sectionTitle}>Theme</div>
              <div style={settingsStyles.themeRow}>
                {[["dark","Dark"],["light","Light"],["system","System"]].map(([k, l]) => (
                  <button key={k} style={settingsStyles.themeBtn(theme === k)} onClick={() => setTheme(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.sectionTitle}>Accent color</div>
              <div style={settingsStyles.swatchRow}>
                {ACCENT_OPTIONS.map((c) => (
                  <button key={c} style={settingsStyles.swatch(c, accent === c)} onClick={() => setAccent(c)} aria-label={c} />
                ))}
              </div>
            </div>
          </>
        )}

        {section === "notifications" && (
          <>
            <h1 style={settingsStyles.h1}>Notifications</h1>
            <p style={settingsStyles.sub}>How JustDoIt reaches you. You can fine-tune reminders per task.</p>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.row}>
                <div>
                  <div style={settingsStyles.rowMain}>Daily digest email</div>
                  <div style={settingsStyles.rowMeta}>A summary of today's tasks and overdue items, sent at 8am local.</div>
                </div>
                <div style={settingsStyles.toggle(digest)} onClick={() => setDigest((v) => !v)}>
                  <div style={settingsStyles.thumb(digest)} />
                </div>
              </div>
              <div style={{ ...settingsStyles.row, ...settingsStyles.rowLast }}>
                <div>
                  <div style={settingsStyles.rowMain}>In-app reminder toasts</div>
                  <div style={settingsStyles.rowMeta}>Show a toast when a reminder fires while the app is open.</div>
                </div>
                <div style={settingsStyles.toggle(inApp)} onClick={() => setInApp((v) => !v)}>
                  <div style={settingsStyles.thumb(inApp)} />
                </div>
              </div>
            </div>
          </>
        )}

        {section === "workspaces" && (
          <>
            <h1 style={settingsStyles.h1}>Workspaces</h1>
            <p style={settingsStyles.sub}>Spaces you share with others. Invites only — no public discovery.</p>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.sectionTitle}>Personal · Owner</div>
              <div style={settingsStyles.memberRow}>
                <div style={settingsStyles.memberAvatar("#6c63ff")}>AC</div>
                <div style={{ flex: 1 }}>
                  <div style={settingsStyles.memberName}>Alice Carter (you)</div>
                  <div style={settingsStyles.memberEmail}>alice@example.com</div>
                </div>
                <span style={settingsStyles.rolePill("owner")}>Owner</span>
              </div>
            </div>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.sectionTitle}>Team Carbon · Admin</div>
              {[
                { name: "Alice Carter (you)", email: "alice@example.com", role: "admin", bg: "#6c63ff", initial: "AC" },
                { name: "Ben Liu",            email: "ben@example.com",   role: "owner", bg: "#48d1cc", initial: "BL" },
                { name: "Karlo Z.",           email: "karlo@example.com", role: "member", bg: "#f5a623", initial: "KZ" },
                { name: "(pending invite)",   email: "morgan@example.com",role: "pending",bg: "#5a6088", initial: "?" },
              ].map((m, i, arr) => (
                <div key={m.email} style={i === arr.length - 1 ? { ...settingsStyles.memberRow, borderBottom: "none" } : settingsStyles.memberRow}>
                  <div style={settingsStyles.memberAvatar(m.bg)}>{m.initial}</div>
                  <div style={{ flex: 1 }}>
                    <div style={settingsStyles.memberName}>{m.name}</div>
                    <div style={settingsStyles.memberEmail}>{m.email}</div>
                  </div>
                  <span style={settingsStyles.rolePill(m.role)}>{m.role}</span>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <input style={{ ...settingsStyles.input, flex: 1 }} placeholder="invite by email" />
                <select style={{ ...settingsStyles.input, width: "auto", cursor: "pointer" }}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button style={settingsStyles.btnPrimary}>Send invite</button>
              </div>
            </div>
            <div style={{ ...settingsStyles.section, borderColor: "rgba(224,92,92,0.35)" }}>
              <div style={{ ...settingsStyles.sectionTitle, color: "#e05c5c" }}>Danger zone</div>
              <div style={{ ...settingsStyles.row, ...settingsStyles.rowLast }}>
                <div>
                  <div style={settingsStyles.rowMain}>Delete workspace</div>
                  <div style={settingsStyles.rowMeta}>Permanently removes the workspace and all shared content. Members lose access immediately.</div>
                </div>
                <button style={settingsStyles.btnDanger}>Delete workspace</button>
              </div>
            </div>
          </>
        )}

        {section === "export" && (
          <>
            <h1 style={settingsStyles.h1}>Export</h1>
            <p style={settingsStyles.sub}>Download a ZIP of your notes (Markdown) and tasks (JSON). Delivered to your inbox.</p>
            <div style={settingsStyles.section}>
              <button style={settingsStyles.btnPrimary}>Request export</button>
              <div style={{ ...settingsStyles.rowMeta, marginTop: 12 }}>
                Last export: May 12, 2026 · <a href="#" style={{ color: "var(--jd-accent)" }}>download.zip</a>
              </div>
            </div>
          </>
        )}

        {section === "account" && (
          <>
            <h1 style={settingsStyles.h1}>Account</h1>
            <p style={settingsStyles.sub}>Manage authentication and account lifecycle.</p>
            <div style={settingsStyles.section}>
              <div style={settingsStyles.sectionTitle}>Sign-in methods</div>
              <div style={settingsStyles.row}>
                <div>
                  <div style={settingsStyles.rowMain}>Email and password</div>
                  <div style={settingsStyles.rowMeta}>alice@example.com</div>
                </div>
                <button style={settingsStyles.btnGhost}>Change password</button>
              </div>
              <div style={settingsStyles.row}>
                <div>
                  <div style={settingsStyles.rowMain}>GitHub</div>
                  <div style={settingsStyles.rowMeta}>Connected as @alicecarter</div>
                </div>
                <button style={settingsStyles.btnGhost}>Disconnect</button>
              </div>
              <div style={{ ...settingsStyles.row, ...settingsStyles.rowLast }}>
                <div>
                  <div style={settingsStyles.rowMain}>Google</div>
                  <div style={settingsStyles.rowMeta}>Not connected</div>
                </div>
                <button style={settingsStyles.btnGhost}>Connect</button>
              </div>
            </div>
            <div style={{ ...settingsStyles.section, borderColor: "rgba(224,92,92,0.35)" }}>
              <div style={{ ...settingsStyles.sectionTitle, color: "#e05c5c" }}>Danger zone</div>
              <div style={{ ...settingsStyles.row, ...settingsStyles.rowLast }}>
                <div>
                  <div style={settingsStyles.rowMain}>Delete account</div>
                  <div style={settingsStyles.rowMeta}>Permanently remove your account and all data. This can't be undone.</div>
                </div>
                <button style={settingsStyles.btnDanger}>Delete account</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

window.Settings = Settings;

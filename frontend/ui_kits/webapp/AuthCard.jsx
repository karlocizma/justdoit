/* global React */

const authStyles = {
  root: {
    height: "100%",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--jd-bg)",
    padding: 32,
  },
  card: {
    width: 380,
    background: "var(--jd-surface)",
    border: "1px solid var(--jd-border)",
    borderRadius: 16,
    padding: "32px 32px 28px",
    boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
    display: "flex", flexDirection: "column", gap: 16,
  },
  brand: { display: "flex", justifyContent: "center", marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 700, color: "var(--jd-fg)",
           textAlign: "center", letterSpacing: "-0.01em" },
  subtitle: { fontSize: 13, color: "var(--jd-fg-dim)", textAlign: "center",
              marginTop: -8 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: "var(--jd-fg-muted)" },
  input: {
    background: "var(--jd-bg)", border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "10px 12px",
    color: "var(--jd-fg)", fontFamily: "inherit", fontSize: 14, outline: "none",
  },
  forgot: { fontSize: 12, color: "var(--jd-fg-dim)", textDecoration: "none", alignSelf: "flex-end", cursor: "pointer", background: "transparent", border: "none", padding: 0, fontFamily: "inherit" },
  primary: {
    background: "#6c63ff", color: "#fff", border: "none",
    borderRadius: 8, padding: "10px 14px",
    fontFamily: "inherit", fontSize: 14, fontWeight: 600,
    cursor: "pointer",
  },
  divider: {
    display: "flex", alignItems: "center", gap: 10,
    color: "var(--jd-fg-dim)", fontSize: 11, textTransform: "uppercase",
    letterSpacing: "0.08em", margin: "4px 0",
  },
  hr: { flex: 1, height: 1, background: "var(--jd-border)" },
  oauth: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    background: "transparent",
    color: "var(--jd-fg)",
    border: "1px solid var(--jd-border)",
    borderRadius: 8, padding: "9px 14px",
    fontFamily: "inherit", fontSize: 14, fontWeight: 500,
    cursor: "pointer",
  },
  footer: {
    textAlign: "center", fontSize: 13, color: "var(--jd-fg-dim)",
    marginTop: 8,
  },
  link: { color: "var(--jd-accent)", textDecoration: "none", cursor: "pointer", background: "none", border: "none", fontSize: "inherit", fontFamily: "inherit", padding: 0 },
  // check-email state
  checkIcon: {
    width: 48, height: 48, borderRadius: "50%",
    background: "rgba(72,209,204,0.14)", color: "#48d1cc",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 4px",
  },
};

function AuthCard({ onSignIn }) {
  const [mode, setMode] = React.useState("login"); // 'login' | 'register' | 'check-email' | 'forgot' | 'forgot-sent' | 'reset-password'
  const [email, setEmail] = React.useState("alice@example.com");

  if (mode === "reset-password") {
    return (
      <div style={authStyles.root}>
        <form style={authStyles.card} onSubmit={(e) => { e.preventDefault(); onSignIn(); }}>
          <div style={authStyles.brand}><Brand size={40} /></div>
          <h1 style={authStyles.title}>Set new password</h1>
          <div style={authStyles.subtitle}>Choose a strong password for your account.</div>
          <div style={authStyles.field}>
            <label style={authStyles.label}>New password</label>
            <input style={authStyles.input} type="password" placeholder="At least 8 characters" autoFocus />
          </div>
          <div style={authStyles.field}>
            <label style={authStyles.label}>Confirm new password</label>
            <input style={authStyles.input} type="password" />
          </div>
          <button type="submit" style={authStyles.primary}>Set password</button>
        </form>
      </div>
    );
  }

  if (mode === "check-email") {
    return (
      <div style={authStyles.root}>
        <div style={authStyles.card}>
          <div style={authStyles.brand}><Brand size={40} /></div>
          <div style={authStyles.checkIcon}><IconMail size={22} /></div>
          <h1 style={authStyles.title}>Check your email</h1>
          <div style={authStyles.subtitle}>
            We sent a confirmation link to <strong style={{ color: "var(--jd-fg)" }}>{email}</strong>.
            Click it to finish creating your account.
          </div>
          <button type="button" style={authStyles.primary} onClick={() => setMode("login")}>Back to sign in</button>
          <div style={authStyles.footer}>
            Didn't get it? <button type="button" style={authStyles.link} onClick={() => {}}>Resend</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "forgot-sent") {
    return (
      <div style={authStyles.root}>
        <div style={authStyles.card}>
          <div style={authStyles.brand}><Brand size={40} /></div>
          <div style={authStyles.checkIcon}><IconMail size={22} /></div>
          <h1 style={authStyles.title}>Reset link sent</h1>
          <div style={authStyles.subtitle}>
            If <strong style={{ color: "var(--jd-fg)" }}>{email}</strong> has an account, a reset link is on its way.
          </div>
          <button type="button" style={authStyles.primary} onClick={() => setMode("login")}>Back to sign in</button>
        </div>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <div style={authStyles.root}>
        <form style={authStyles.card} onSubmit={(e) => { e.preventDefault(); setMode("forgot-sent"); }}>
          <div style={authStyles.brand}><Brand size={40} /></div>
          <h1 style={authStyles.title}>Reset password</h1>
          <div style={authStyles.subtitle}>Enter your email — we'll send a reset link.</div>
          <div style={authStyles.field}>
            <label style={authStyles.label}>Email</label>
            <input style={authStyles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" style={authStyles.primary}>Send reset link</button>
          <div style={authStyles.footer}>
            <button type="button" style={authStyles.link} onClick={() => setMode("login")}>Back to sign in</button>
          </div>
        </form>
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div style={authStyles.root}>
      <form
        style={authStyles.card}
        onSubmit={(e) => {
          e.preventDefault();
          if (isRegister) setMode("check-email");
          else onSignIn();
        }}
      >
        <div style={authStyles.brand}><Brand size={40} /></div>
        <h1 style={authStyles.title}>{isRegister ? "Create your account" : "Sign in"}</h1>
        <div style={authStyles.subtitle}>
          {isRegister ? "Notes & tasks, done right." : "Welcome back. Pick up where you left off."}
        </div>

        <div style={authStyles.field}>
          <label style={authStyles.label}>Email</label>
          <input style={authStyles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={authStyles.field}>
          <label style={authStyles.label}>Password</label>
          <input style={authStyles.input} type="password" defaultValue={isRegister ? "" : "••••••••••"} placeholder={isRegister ? "At least 8 characters" : undefined} />
        </div>
        {isRegister && (
          <div style={authStyles.field}>
            <label style={authStyles.label}>Confirm password</label>
            <input style={authStyles.input} type="password" />
          </div>
        )}
        {!isRegister && (
          <button type="button" style={authStyles.forgot} onClick={() => setMode("forgot")}>Forgot password?</button>
        )}
        <button type="submit" style={authStyles.primary}>{isRegister ? "Create account" : "Sign in"}</button>

        <div style={authStyles.divider}>
          <span style={authStyles.hr} /><span>or</span><span style={authStyles.hr} />
        </div>

        <button type="button" style={authStyles.oauth}>
          <img src="../../assets/oauth-github.svg" alt="" width="16" height="16" style={{ filter: "invert(1) opacity(0.9)" }} />
          Continue with GitHub
        </button>
        <button type="button" style={authStyles.oauth}>
          <img src="../../assets/oauth-google.svg" alt="" width="16" height="16" />
          Continue with Google
        </button>

        <div style={authStyles.footer}>
          {isRegister
            ? <>Already have an account? <button type="button" style={authStyles.link} onClick={() => setMode("login")}>Sign in</button></>
            : <>New here? <button type="button" style={authStyles.link} onClick={() => setMode("register")}>Create an account</button></>
          }
        </div>
      </form>
    </div>
  );
}

window.AuthCard = AuthCard;

// Branded email HTML for JustDoIt transactional emails.
// All emails use a light theme — dark mode in email clients is unreliable.

const base = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
</head>
<body style="margin:0;padding:0;background-color:#f4f4f8;font-family:'Segoe UI',system-ui,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f8;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:26px;font-weight:800;color:#6c63ff;letter-spacing:-0.5px;">JustDoIt</span>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
              ${content}
            </td>
          </tr>

          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#aab0c6;">
                © ${new Date().getFullYear()} JustDoIt. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

const button = (href: string, label: string) =>
  `<a href="${href}"
     style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#5a52e8);
            color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;
            padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">${label}</a>`

const fallbackLink = (href: string) =>
  `<p style="margin:12px 0 0;font-size:12px;color:#7b82a8;word-break:break-all;">
    Or copy this link: <a href="${href}" style="color:#6c63ff;">${href}</a>
  </p>`

export function digestEmail(params: {
  displayName:    string
  dueTodayTasks:  Array<{ title: string; list_title: string }>
  overdueTasks:   Array<{ title: string; list_title: string; due_date: string }>
  appUrl:         string
}): { subject: string; html: string } {
  const todayRows = params.dueTodayTasks.map(t =>
    `<tr>
       <td style="padding:6px 0;font-size:14px;color:#1a1d27;">● ${t.title}</td>
       <td style="padding:6px 0;font-size:12px;color:#7b82a8;text-align:right;">${t.list_title}</td>
     </tr>`,
  ).join("") || `<tr><td colspan="2" style="padding:6px 0;font-size:14px;color:#aab0c6;">All caught up 🎉</td></tr>`

  const overdueRows = params.overdueTasks.map(t =>
    `<tr>
       <td style="padding:6px 0;font-size:14px;color:#e05c5c;">● ${t.title}</td>
       <td style="padding:6px 0;font-size:12px;color:#7b82a8;text-align:right;">${t.list_title} · ${t.due_date}</td>
     </tr>`,
  ).join("")

  const overdueSection = params.overdueTasks.length > 0 ? `
    <tr><td colspan="2" style="padding-top:20px;padding-bottom:4px;">
      <p style="margin:0;font-size:13px;font-weight:700;color:#e05c5c;text-transform:uppercase;letter-spacing:0.5px;">
        Overdue (${params.overdueTasks.length})
      </p>
    </td></tr>
    ${overdueRows}` : ""

  return {
    subject: `Your daily digest — ${params.dueTodayTasks.length} task${params.dueTodayTasks.length !== 1 ? "s" : ""} due today`,
    html: base(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="width:52px;height:52px;background:linear-gradient(135deg,#6c63ff,#48d1cc);
                        border-radius:13px;display:inline-block;line-height:52px;
                        text-align:center;font-size:26px;">📋</div>
          </td>
        </tr>
        <tr>
          <td>
            <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1a1d27;text-align:center;">
              Good morning, ${params.displayName}!
            </h1>
            <p style="margin:0 0 24px;font-size:15px;color:#7b82a8;text-align:center;">Here's your task summary for today.</p>
          </td>
        </tr>
        <tr><td>
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#6c63ff;text-transform:uppercase;letter-spacing:0.5px;">
            Due today (${params.dueTodayTasks.length})
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">${todayRows}${overdueSection}</table>
        </td></tr>
        <tr>
          <td align="center" style="padding-top:24px;">
            <a href="${params.appUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#5a52e8);
                      color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;
                      padding:12px 32px;border-radius:10px;">
              Open JustDoIt
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:20px;border-top:1px solid #f0f0f5;margin-top:20px;">
            <p style="margin:0;font-size:11px;color:#aab0c6;">
              Unsubscribe by turning off Daily digest in your profile settings.
            </p>
          </td>
        </tr>
      </table>`),
  }
}

export function exportReadyEmail(params: {
  displayName:  string
  downloadUrl:  string
  expiresHours: number
  noteCount:    number
  taskCount:    number
}): { subject: string; html: string } {
  return {
    subject: "Your JustDoIt export is ready",
    html: base(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="width:52px;height:52px;background:linear-gradient(135deg,#48d1cc,#6c63ff);
                        border-radius:13px;display:inline-block;line-height:52px;
                        text-align:center;font-size:26px;">📦</div>
          </td>
        </tr>
        <tr>
          <td>
            <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1a1d27;text-align:center;">
              Your export is ready
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#7b82a8;line-height:1.65;text-align:center;">
              Hi ${params.displayName}! Your JustDoIt data export is ready to download.
            </p>
            <div style="background:#f4f4f8;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;color:#7b82a8;">Notes exported</td>
                  <td style="font-size:14px;font-weight:600;color:#1a1d27;text-align:right;">${params.noteCount}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#7b82a8;padding-top:6px;">Tasks exported</td>
                  <td style="font-size:14px;font-weight:600;color:#1a1d27;text-align:right;padding-top:6px;">${params.taskCount}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:8px;">
            <a href="${params.downloadUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#5a52e8);
                      color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;
                      padding:14px 36px;border-radius:10px;">
              Download ZIP
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:16px;border-top:1px solid #f0f0f5;margin-top:16px;">
            <p style="margin:0;font-size:12px;color:#aab0c6;">
              This link expires in ${params.expiresHours} hours. Request a new export any time from your settings.
            </p>
          </td>
        </tr>
      </table>`),
  }
}

export function reminderEmail(params: {
  displayName:  string
  contextKind:  "note" | "task"
  contextTitle: string
  appUrl:       string
}): { subject: string; html: string } {
  const label = params.contextKind === "note" ? "note" : "task"
  return {
    subject: `Reminder: ${params.contextTitle}`,
    html: base(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="width:52px;height:52px;background:linear-gradient(135deg,#48d1cc,#6c63ff);
                        border-radius:13px;display:inline-block;line-height:52px;
                        text-align:center;font-size:26px;">🔔</div>
          </td>
        </tr>
        <tr>
          <td>
            <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1a1d27;text-align:center;">
              Your reminder is here
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#7b82a8;line-height:1.65;text-align:center;">
              Hi ${params.displayName}, you set a reminder for this ${label}:
            </p>
            <div style="background:#f4f4f8;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;font-size:16px;font-weight:600;color:#1a1d27;text-align:center;">
                ${params.contextTitle}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:8px;">
            <a href="${params.appUrl}"
               style="display:inline-block;background:linear-gradient(135deg,#6c63ff,#5a52e8);
                      color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;
                      padding:14px 36px;border-radius:10px;letter-spacing:0.2px;">
              Open JustDoIt
            </a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;border-top:1px solid #f0f0f5;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#aab0c6;">
              You're receiving this because you scheduled a reminder in JustDoIt.
            </p>
          </td>
        </tr>
      </table>`),
  }
}

export function verificationEmail(params: {
  displayName: string
  confirmationUrl: string
}): { subject: string; html: string } {
  return {
    subject: "Confirm your JustDoIt account",
    html: base(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="width:52px;height:52px;background:linear-gradient(135deg,#6c63ff,#48d1cc);
                        border-radius:13px;display:inline-block;line-height:52px;
                        text-align:center;font-size:26px;">✉️</div>
          </td>
        </tr>
        <tr>
          <td>
            <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1a1d27;text-align:center;">
              Confirm your email
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#7b82a8;line-height:1.65;text-align:center;">
              Hi ${params.displayName}, welcome to JustDoIt!<br />
              Click below to verify your email and get started.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:8px;">
            ${button(params.confirmationUrl, "Confirm email address")}
            ${fallbackLink(params.confirmationUrl)}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;border-top:1px solid #f0f0f5;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#aab0c6;">
              This link expires in 1 hour. If you didn't create an account, ignore this email.
            </p>
          </td>
        </tr>
      </table>`),
  }
}

export function passwordResetEmail(params: {
  email: string
  resetUrl: string
}): { subject: string; html: string } {
  return {
    subject: "Reset your JustDoIt password",
    html: base(`
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding-bottom:20px;">
            <div style="width:52px;height:52px;background:linear-gradient(135deg,#f5a623,#e05c5c);
                        border-radius:13px;display:inline-block;line-height:52px;
                        text-align:center;font-size:26px;">🔑</div>
          </td>
        </tr>
        <tr>
          <td>
            <h1 style="margin:0 0 6px;font-size:21px;font-weight:700;color:#1a1d27;text-align:center;">
              Reset your password
            </h1>
            <p style="margin:0 0 28px;font-size:15px;color:#7b82a8;line-height:1.65;text-align:center;">
              We received a password reset request for
              <strong style="color:#1a1d27;">${params.email}</strong>.<br />
              Click below to choose a new password.
            </p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-bottom:8px;">
            ${button(params.resetUrl, "Reset password")}
            ${fallbackLink(params.resetUrl)}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding-top:24px;border-top:1px solid #f0f0f5;margin-top:24px;">
            <p style="margin:0;font-size:12px;color:#e05c5c;">
              If you didn't request a password reset, your account is safe — ignore this email.
            </p>
          </td>
        </tr>
      </table>`),
  }
}

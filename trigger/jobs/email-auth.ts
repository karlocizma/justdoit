import { task } from "@trigger.dev/sdk/v3"
import { sendEmail } from "../lib/email.js"
import { verificationEmail, passwordResetEmail } from "../lib/email-templates.js"

const FROM = process.env["FROM_EMAIL"] ?? "noreply@justdoit.app"

// ── Triggered by the auth-hook Edge Function on signup / invite ───────────────
export const sendVerificationEmail = task({
  id: "auth.send-verification",
  retry: { maxAttempts: 3 },
  run: async (payload: {
    email:           string
    displayName:     string
    actionUrl:       string
    emailActionType: string
  }) => {
    const { subject, html } = verificationEmail({
      displayName:     payload.displayName,
      confirmationUrl: payload.actionUrl,
    })

    return await sendEmail({ from: FROM, to: payload.email, subject, html })
  },
})

// ── Triggered by the auth-hook Edge Function on password reset ────────────────
export const sendPasswordResetEmail = task({
  id: "auth.send-password-reset",
  retry: { maxAttempts: 3 },
  run: async (payload: {
    email:       string
    displayName: string
    actionUrl:   string
  }) => {
    const { subject, html } = passwordResetEmail({
      email:    payload.email,
      resetUrl: payload.actionUrl,
    })

    return await sendEmail({ from: FROM, to: payload.email, subject, html })
  },
})

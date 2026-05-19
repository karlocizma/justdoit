import { task } from "@trigger.dev/sdk/v3"
import { Resend } from "resend"
import { verificationEmail, passwordResetEmail } from "../lib/email-templates.js"

const FROM = process.env["FROM_EMAIL"] ?? "noreply@justdoit.app"

function resend() {
  const key = process.env["RESEND_API_KEY"]
  if (!key) throw new Error("RESEND_API_KEY is not set")
  return new Resend(key)
}

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

    const result = await resend().emails.send({
      from:    FROM,
      to:      payload.email,
      subject,
      html,
    })

    return { messageId: result.data?.id }
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

    const result = await resend().emails.send({
      from:    FROM,
      to:      payload.email,
      subject,
      html,
    })

    return { messageId: result.data?.id }
  },
})

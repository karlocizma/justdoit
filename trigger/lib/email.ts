/**
 * Email transport for background jobs.
 *
 * Picks the transport from the environment so the same job code works on the
 * cloud deployment (Resend) and a fully self-hosted deployment (SMTP):
 *
 *   1. SMTP_HOST set        → send via SMTP (nodemailer) — no cloud dependency
 *   2. else RESEND_API_KEY  → send via Resend
 *   3. else                 → throw (caller's retry/backoff applies)
 *
 * SMTP env: SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
 *           SMTP_SECURE ("true" for implicit TLS / port 465).
 */

import { Resend } from "resend"
import nodemailer from "nodemailer"

export interface EmailMessage {
  from: string
  to: string
  subject: string
  html: string
}

export async function sendEmail(msg: EmailMessage): Promise<{ messageId?: string }> {
  const smtpHost = process.env["SMTP_HOST"]
  if (smtpHost) return sendViaSmtp(msg, smtpHost)

  const resendKey = process.env["RESEND_API_KEY"]
  if (resendKey) return sendViaResend(msg, resendKey)

  throw new Error("No email transport configured — set SMTP_HOST or RESEND_API_KEY")
}

/** True when any email transport is configured (lets callers degrade gracefully). */
export function emailConfigured(): boolean {
  return !!(process.env["SMTP_HOST"] || process.env["RESEND_API_KEY"])
}

async function sendViaResend(msg: EmailMessage, apiKey: string): Promise<{ messageId?: string }> {
  const result = await new Resend(apiKey).emails.send(msg)
  return result.data?.id ? { messageId: result.data.id } : {}
}

async function sendViaSmtp(msg: EmailMessage, host: string): Promise<{ messageId?: string }> {
  const port = Number(process.env["SMTP_PORT"] ?? 587)
  const user = process.env["SMTP_USER"]
  const pass = process.env["SMTP_PASS"]
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env["SMTP_SECURE"] === "true" || port === 465,
    ...(user && pass ? { auth: { user, pass } } : {}),
  })
  const info = await transport.sendMail(msg)
  return { messageId: info.messageId }
}

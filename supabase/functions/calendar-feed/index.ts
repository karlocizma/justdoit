/**
 * GET /functions/v1/calendar-feed?token=<feed-token>
 *
 * Returns an iCalendar (.ics) feed of the user's tasks (with a due date) and
 * notes (with a due date) so they can subscribe from Google / Apple / Outlook.
 *
 * Authenticated by a per-user, revocable feed token stored at
 * `profiles.settings.calendar_feed_token` — NOT the session JWT, because
 * calendar clients poll this URL unattended with no auth headers. The function
 * therefore runs with `verify_jwt = false` (see config.toml) and looks the user
 * up by token using the service-role key (bypassing RLS).
 *
 * Read-only and one-way: the feed reflects current data; there is no write-back.
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  const token = new URL(req.url).searchParams.get("token")?.trim()
  if (!token) {
    return new Response("Missing feed token", { status: 400, headers: corsHeaders })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  )

  // Look up the owner of this feed token.
  const { data: profile } = await admin
    .from("profiles")
    .select("id, display_name")
    .filter("settings->>calendar_feed_token", "eq", token)
    .maybeSingle()

  if (!profile) {
    // Don't reveal whether the token format is valid — just 404.
    return new Response("Feed not found", { status: 404, headers: corsHeaders })
  }

  const userId = profile.id as string

  // Tasks with a due date (ownership via the parent list's user_id), plus notes
  // with a due date. Service role bypasses RLS, so both are filtered explicitly.
  const [{ data: tasks }, { data: notes }] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, notes, due_date, due_time, is_completed, priority, todo_lists!inner(user_id, title)")
      .eq("todo_lists.user_id", userId)
      .not("due_date", "is", null),
    admin
      .from("notes")
      .select("id, title, due_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .not("due_at", "is", null),
  ])

  const calName = profile.display_name
    ? `JustDoIt — ${profile.display_name}`
    : "JustDoIt"

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JustDoIt//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calName)}`,
    "X-PUBLISHED-TTL:PT1H",
  ]

  const stamp = formatUtc(new Date())

  for (const t of tasks ?? []) {
    const summary = `${t.is_completed ? "✓ " : ""}${t.title ?? "Untitled task"}`
    const listTitle = (t as any).todo_lists?.title as string | undefined
    const descParts = [
      t.notes ? String(t.notes) : "",
      listTitle ? `List: ${listTitle}` : "",
      PRIORITY_LABEL[t.priority as number] ? `Priority: ${PRIORITY_LABEL[t.priority as number]}` : "",
    ].filter(Boolean)

    lines.push(
      "BEGIN:VEVENT",
      `UID:task-${t.id}@justdoit`,
      `DTSTAMP:${stamp}`,
      ...dtStartLines(t.due_date as string, t.due_time as string | null),
      `SUMMARY:${escapeText(summary)}`,
      ...(descParts.length ? [`DESCRIPTION:${escapeText(descParts.join("\n"))}`] : []),
      "END:VEVENT",
    )
  }

  for (const n of notes ?? []) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:note-${n.id}@justdoit`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${formatUtc(new Date(n.due_at as string))}`,
      `SUMMARY:${escapeText(`📝 ${n.title || "Untitled note"}`)}`,
      "END:VEVENT",
    )
  }

  lines.push("END:VCALENDAR")

  const body = lines.map(foldLine).join("\r\n") + "\r\n"

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="justdoit.ics"',
      "cache-control": "no-cache, max-age=0",
    },
  })
})

const PRIORITY_LABEL: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" }

/** DTSTART line(s) for a task: all-day if no time, else a floating local datetime. */
function dtStartLines(dueDate: string, dueTime: string | null): string[] {
  if (!dueTime) {
    // All-day event: DTSTART;VALUE=DATE:YYYYMMDD
    return [`DTSTART;VALUE=DATE:${dueDate.replace(/-/g, "")}`]
  }
  // Floating local time (no Z / TZID) — shown in the viewer's local zone.
  const [h, m] = dueTime.split(":")
  return [`DTSTART:${dueDate.replace(/-/g, "")}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`]
}

/** YYYYMMDDTHHMMSSZ in UTC. */
function formatUtc(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** Escape per RFC 5545 §3.3.11 (backslash, semicolon, comma, newline). */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1) using CRLF + space. */
function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let current = ""
  let bytes = 0
  for (const ch of line) {
    const chBytes = enc.encode(ch).length
    // Continuation lines start with a space, leaving 74 octets of payload.
    const limit = out.length === 0 ? 75 : 74
    if (bytes + chBytes > limit) {
      out.push(current)
      current = ch
      bytes = chBytes
    } else {
      current += ch
      bytes += chBytes
    }
  }
  if (current) out.push(current)
  return out.join("\r\n ")
}

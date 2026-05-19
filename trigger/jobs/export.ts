/**
 * export.generate — Trigger.dev v3 task
 *
 * Triggered by POST /functions/v1/export (user auth required).
 * Builds a ZIP archive of the user's data and emails a time-limited
 * download link.
 *
 * ZIP structure:
 *   manifest.json           — metadata (user, date, counts)
 *   notes/{title}.md        — each active + archived note as Markdown
 *   tasks/{list-title}.json — tasks per list (sorted by sort_order)
 *
 * The ZIP is uploaded to Supabase Storage at:
 *   exports/{user_id}/{run_id}.zip
 *
 * A 7-day signed URL is generated and emailed.
 *
 * Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           RESEND_API_KEY, FROM_EMAIL, APP_URL
 */

import { task } from "@trigger.dev/sdk/v3"
import { createClient } from "@supabase/supabase-js"
import { Resend } from "resend"
import JSZip from "jszip"
import { exportReadyEmail } from "../lib/email-templates.js"

interface ExportPayload {
  user_id: string
  run_id:  string   // Trigger.dev run ID, used as the ZIP filename
}

function supabaseAdmin() {
  const url = process.env["SUPABASE_URL"]
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
  return createClient(url, key, { auth: { persistSession: false } })
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "untitled"
}

export const generateExport = task({
  id: "export.generate",
  // Long-running: allow up to 15 minutes for large data sets
  machine: { preset: "small-1x" },

  run: async (payload: ExportPayload) => {
    const db = supabaseAdmin()

    // ── Fetch all user data in parallel ────────────────────────────────────
    const [notesRes, listsRes, profileRes, authRes] = await Promise.all([
      db.from("notes")
        .select("id, title, content, color, is_pinned, is_archived, created_at, updated_at")
        .eq("user_id", payload.user_id)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),

      db.from("todo_lists")
        .select("id, title, tasks(id, title, notes, priority, due_date, is_completed, sort_order, recurrence, parent_id)")
        .eq("user_id", payload.user_id)
        .order("sort_order"),

      db.from("profiles")
        .select("display_name")
        .eq("id", payload.user_id)
        .single(),

      db.auth.admin.getUserById(payload.user_id),
    ])

    const notes    = notesRes.data   ?? []
    const lists    = listsRes.data   ?? []
    const userName = profileRes.data?.display_name ?? "User"
    const email    = authRes.data.user?.email ?? ""

    // ── Build ZIP ───────────────────────────────────────────────────────────
    const zip      = new JSZip()
    const noteCount = notes.length
    let taskCount   = 0

    // manifest.json
    zip.file("manifest.json", JSON.stringify({
      exported_at: new Date().toISOString(),
      user_name:   userName,
      note_count:  noteCount,
      list_count:  lists.length,
    }, null, 2))

    // notes/{slug}.md
    const notesFolder = zip.folder("notes")!
    const seenSlugs = new Map<string, number>()
    for (const note of notes) {
      let slug = slugify(note.title || "untitled")
      const count = seenSlugs.get(slug) ?? 0
      seenSlugs.set(slug, count + 1)
      if (count > 0) slug = `${slug}-${count}`

      const frontmatter = [
        "---",
        `title: "${note.title.replace(/"/g, '\\"')}"`,
        note.color     ? `color: "${note.color}"`               : null,
        note.is_pinned ? `pinned: true`                          : null,
        note.is_archived ? `archived: true`                      : null,
        `created: "${note.created_at}"`,
        `updated: "${note.updated_at}"`,
        "---",
      ].filter(Boolean).join("\n")

      notesFolder.file(`${slug}.md`, `${frontmatter}\n\n${note.content}\n`)
    }

    // tasks/{list-slug}.json
    const tasksFolder = zip.folder("tasks")!
    const seenListSlugs = new Map<string, number>()
    for (const list of lists) {
      let slug = slugify(list.title)
      const count = seenListSlugs.get(slug) ?? 0
      seenListSlugs.set(slug, count + 1)
      if (count > 0) slug = `${slug}-${count}`

      const tasks = (list.tasks as unknown[]) ?? []
      taskCount += tasks.length
      tasksFolder.file(`${slug}.json`, JSON.stringify({
        list:  list.title,
        tasks,
      }, null, 2))
    }

    // ── Upload to Supabase Storage ──────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
    const storagePath = `${payload.user_id}/${payload.run_id}.zip`

    const { error: uploadErr } = await db.storage
      .from("exports")
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert:      true,
      })

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`)

    // ── Generate 7-day signed URL ───────────────────────────────────────────
    const SEVEN_DAYS = 7 * 24 * 60 * 60
    const { data: signedData, error: signErr } = await db.storage
      .from("exports")
      .createSignedUrl(storagePath, SEVEN_DAYS)

    if (signErr || !signedData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signErr?.message}`)
    }

    // ── Send email ──────────────────────────────────────────────────────────
    const resendKey = process.env["RESEND_API_KEY"]
    if (!resendKey) throw new Error("RESEND_API_KEY is not set")

    const { subject, html } = exportReadyEmail({
      displayName:  userName,
      downloadUrl:  signedData.signedUrl,
      expiresHours: SEVEN_DAYS / 3600,
      noteCount,
      taskCount,
    })

    await new Resend(resendKey).emails.send({
      from:    process.env["FROM_EMAIL"] ?? "noreply@justdoit.app",
      to:      email,
      subject,
      html,
    })

    return {
      noteCount,
      taskCount,
      storagePath,
      expiresAt: new Date(Date.now() + SEVEN_DAYS * 1000).toISOString(),
    }
  },
})

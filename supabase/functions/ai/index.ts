import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"
const MODEL = "claude-haiku-4-5-20251001"

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json({ error: "missing authorization header" }, 401)

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return json({ error: "invalid JSON body" }, 400)
  }

  const { action, content, title, query } = body

  // Server-level key takes precedence; fall back to the user's own key stored in their profile
  let apiKey: string | null = Deno.env.get("ANTHROPIC_API_KEY") ?? null

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  if (!apiKey) {
    const { data: profile } = await supabase.from("profiles").select("settings").single()
    apiKey = (profile?.settings as { anthropic_api_key?: string } | null)?.anthropic_api_key ?? null
  }

  if (!apiKey) {
    return json({ error: "No API key configured. Add your Anthropic API key in Settings → AI." }, 503)
  }

  let systemPrompt: string
  let userPrompt: string

  if (action === "summarize") {
    if (!content) return json({ error: "content required" }, 400)
    systemPrompt = "You summarize notes concisely. Reply with only the summary text, no preamble or labels."
    userPrompt = `Summarize this note in 2-3 sentences:\n\nTitle: ${title ?? ""}\n\n${content}`

  } else if (action === "suggest-tags") {
    if (!content) return json({ error: "content required" }, 400)
    systemPrompt = `You suggest tags for notes. Reply with ONLY a JSON array of lowercase tag strings, max 5 items. Example: ["project","meeting","q4"]`
    userPrompt = `Suggest relevant tags for this note:\n\nTitle: ${title ?? ""}\n\n${content}`

  } else if (action === "generate-tasks") {
    if (!content) return json({ error: "content required" }, 400)
    systemPrompt = `You extract action items from notes. Reply with ONLY a JSON array of task title strings. Each task should be specific and actionable. Example: ["Send follow-up email to Alex","Review PR #42"]`
    userPrompt = `Extract all action items and tasks from this note:\n\nTitle: ${title ?? ""}\n\n${content}`

  } else if (action === "smart-search") {
    if (!query) return json({ error: "query required" }, 400)

    const { data: notes, error } = await supabase
      .from("notes")
      .select("id, title, content")
      .is("deleted_at", null)
      .eq("is_archived", false)
      .limit(150)

    if (error) return json({ error: error.message }, 400)

    const noteList = (notes ?? [])
      .map((n, i) => `${i + 1}. id=${n.id} | title=${n.title ?? "Untitled"} | ${(n.content ?? "").slice(0, 300)}`)
      .join("\n")

    systemPrompt = `You find relevant notes based on a natural language query. Reply with ONLY a JSON array of objects like {"id":"...","title":"...","reason":"..."} for notes that match the query. Return [] if nothing matches.`
    userPrompt = `Query: "${query}"\n\nNotes:\n${noteList}`

  } else {
    return json({ error: `unknown action: ${action}` }, 400)
  }

  const resp = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    return json({ error: `Anthropic API error: ${err}` }, 502)
  }

  const data = await resp.json()
  const text: string = data.content?.[0]?.text ?? ""

  if (action === "summarize") {
    return json({ summary: text })
  }

  if (action === "suggest-tags") {
    let tags: string[] = []
    try { tags = JSON.parse(text) } catch { /* ignore */ }
    return json({ tags: Array.isArray(tags) ? tags : [] })
  }

  if (action === "generate-tasks") {
    let tasks: string[] = []
    try { tasks = JSON.parse(text) } catch { /* ignore */ }
    return json({ tasks: Array.isArray(tasks) ? tasks : [] })
  }

  if (action === "smart-search") {
    let results: { id: string; title: string; reason: string }[] = []
    try { results = JSON.parse(text) } catch { /* ignore */ }
    return json({ results: Array.isArray(results) ? results : [] })
  }

  return json({ error: "unexpected state" }, 500)
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
}

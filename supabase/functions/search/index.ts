/**
 * GET /functions/v1/search?q=<query>[&type=note|task][&limit=20]
 *
 * Wraps the search_all PostgreSQL RPC with a GET-friendly API surface:
 *   q     — required search query (full-text for notes, trigram for tasks)
 *   type  — optional filter: "note" or "task" (default: both)
 *   limit — max results to return (default 20, max 100)
 *
 * Returns:
 *   { results: SearchResult[], total: number, limit: number }
 *
 * RLS is enforced through the Supabase client — users only see their own data.
 */

import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders, handleCors } from "../_shared/cors.ts"

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "missing authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  const url    = new URL(req.url)
  const q      = url.searchParams.get("q")?.trim() ?? ""
  const type   = url.searchParams.get("type")   // "note" | "task" | null (both)
  const limit  = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

  if (!q) {
    return new Response(
      JSON.stringify({ error: "query param 'q' is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    )
  }

  if (isNaN(limit) || limit < 1) {
    return new Response(
      JSON.stringify({ error: "'limit' must be a positive integer" }),
      {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    )
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data, error } = await supabase.rpc("search_all", { query: q })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    })
  }

  type SearchRow = { kind: string; id: string; title: string; snippet: string; updated_at: string }

  let results: SearchRow[] = data ?? []

  if (type === "note" || type === "task") {
    results = results.filter(r => r.kind === type)
  }

  const total = results.length
  results = results.slice(0, limit)

  return new Response(JSON.stringify({ results, total, limit }), {
    status: 200,
    headers: { ...corsHeaders, "content-type": "application/json" },
  })
})

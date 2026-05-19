/**
 * Integration tests for Edge Functions (Milestone 5).
 *
 * Covers:
 *  - GET /functions/v1/dashboard  — aggregate counts, lists, recent notes
 *  - GET /functions/v1/search     — full-text + trigram, type filter, limit
 *  - Auth enforcement             — unauthenticated → 401
 *  - RLS isolation                — Bob sees only Bob's data
 *
 * Run:  npx tsx scripts/test-functions.ts
 */
import { createClient } from "@supabase/supabase-js"
import type { Database } from "../shared/database.types.js"

const SUPABASE_URL = "http://127.0.0.1:14321"
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
const FN_BASE = `${SUPABASE_URL}/functions/v1`

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0

function ok(label: string, value: unknown) {
  if (value) { console.log(`  ✓  ${label}`); passed++ }
  else        { console.error(`  ✗  ${label}  →  ${JSON.stringify(value)}`); failed++ }
}

function section(title: string) { console.log(`\n── ${title} ──`) }

function client() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  })
}

async function signIn(c: ReturnType<typeof client>, email: string, password: string) {
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
}

async function getJwt(c: ReturnType<typeof client>): Promise<string> {
  const { data } = await c.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error("No access token in session")
  return token
}

type DashboardBody = {
  notes:   { total: number; pinned: number; archived: number; in_trash: number }
  tasks:   { total: number; completed: number; due_today: number; overdue: number }
  lists:   Array<{ id: string; title: string; task_count: number; completed_count: number }>
  recent_notes: Array<{ id: string; title: string; updated_at: string }>
}

type SearchBody = {
  results: Array<{ kind: string; id: string; title: string; snippet: string; updated_at: string }>
  total:   number
  limit:   number
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("JustDoIt — Edge Functions integration tests\n")

  const alice = client()
  const bob   = client()
  await signIn(alice, "alice@example.com", "password123")
  await signIn(bob,   "bob@example.com",   "password123")

  const aliceJwt = await getJwt(alice)
  const bobJwt   = await getJwt(bob)


  // ── 1. Auth enforcement ──────────────────────────────────────────────────
  section("Auth enforcement")

  const dashNoAuth = await fetch(`${FN_BASE}/dashboard`)
  ok("Dashboard without auth → 401",  dashNoAuth.status === 401)

  const searchNoAuth = await fetch(`${FN_BASE}/search?q=test`)
  ok("Search without auth → 401",     searchNoAuth.status === 401)


  // ── 2. Dashboard — structure ─────────────────────────────────────────────
  section("Dashboard — response shape")

  const dashRes = await fetch(`${FN_BASE}/dashboard`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  ok("Dashboard returns 200",         dashRes.status === 200)

  const dash: DashboardBody = await dashRes.json()

  ok("Has notes object",              typeof dash.notes === "object")
  ok("Has tasks object",              typeof dash.tasks === "object")
  ok("Has lists array",               Array.isArray(dash.lists))
  ok("Has recent_notes array",        Array.isArray(dash.recent_notes))

  ok("notes.total is a number",       typeof dash.notes?.total === "number")
  ok("notes.pinned is a number",      typeof dash.notes?.pinned === "number")
  ok("notes.archived is a number",    typeof dash.notes?.archived === "number")
  ok("notes.in_trash is a number",    typeof dash.notes?.in_trash === "number")

  ok("tasks.total is a number",       typeof dash.tasks?.total === "number")
  ok("tasks.completed is a number",   typeof dash.tasks?.completed === "number")
  ok("tasks.due_today is a number",   typeof dash.tasks?.due_today === "number")
  ok("tasks.overdue is a number",     typeof dash.tasks?.overdue === "number")


  // ── 3. Dashboard — counts match seed data ────────────────────────────────
  section("Dashboard — seed data counts")

  // Seed: 2 active notes (Welcome, Backend architecture), 0 trash, 0 archived
  ok("Seed note count = 2",           dash.notes.total === 2)
  ok("Seed pinned count = 1",         dash.notes.pinned === 1)   // "Welcome" is pinned
  ok("Seed archived = 0",             dash.notes.archived === 0)
  ok("Seed in_trash = 0",             dash.notes.in_trash === 0)

  // Seed: 5 tasks (all in Alice's lists), 0 completed
  ok("Seed task total = 5",           dash.tasks.total === 5)
  ok("Seed completed = 0",            dash.tasks.completed === 0)

  // Seed: 2 lists (Inbox, Work)
  ok("Seed lists count = 2",          dash.lists.length === 2)

  // Each list row has the expected shape
  const firstList = dash.lists[0]
  ok("List has id",                   typeof firstList?.id === "string")
  ok("List has title",                typeof firstList?.title === "string")
  ok("List has task_count",           typeof firstList?.task_count === "number")
  ok("List has completed_count",      typeof firstList?.completed_count === "number")

  // Task counts per list match seed (Inbox: 3 tasks, Work: 2 tasks)
  const inbox = dash.lists.find(l => l.title === "Inbox")
  const work  = dash.lists.find(l => l.title === "Work")
  ok("Inbox has 3 tasks",             inbox?.task_count === 3)
  ok("Work has 2 tasks",              work?.task_count === 2)

  // recent_notes: max 5 items, each has id + title + updated_at
  ok("recent_notes ≤ 5",             dash.recent_notes.length <= 5)
  ok("recent_notes have ids",        dash.recent_notes.every(n => typeof n.id === "string"))


  // ── 4. Dashboard — RLS (Bob sees his own data) ───────────────────────────
  section("Dashboard — RLS isolation")

  const bobDashRes = await fetch(`${FN_BASE}/dashboard`, {
    headers: { Authorization: `Bearer ${bobJwt}` },
  })
  ok("Bob's dashboard returns 200",   bobDashRes.status === 200)

  const bobDash: DashboardBody = await bobDashRes.json()

  ok("Bob sees 0 notes",              bobDash.notes.total === 0)
  ok("Bob sees 0 tasks",              bobDash.tasks.total === 0)
  // Seed: Bob has 1 list ("My tasks")
  ok("Bob sees 1 list",               bobDash.lists.length === 1)
  ok("Bob's list is 'My tasks'",      bobDash.lists[0]?.title === "My tasks")


  // ── 5. Search — basic ────────────────────────────────────────────────────
  section("Search — basic queries")

  const searchRes = await fetch(`${FN_BASE}/search?q=welcome`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  ok("Search returns 200",            searchRes.status === 200)

  const search: SearchBody = await searchRes.json()
  ok("Has results array",             Array.isArray(search.results))
  ok("Has total",                     typeof search.total === "number")
  ok("Has limit",                     typeof search.limit === "number")
  ok("Finds 'Welcome' note",          search.results.some(r => r.title.toLowerCase().includes("welcome")))
  ok("Result has kind field",         search.results.every(r => r.kind === "note" || r.kind === "task"))
  ok("Result has snippet field",      search.results.every(r => typeof r.snippet === "string"))


  // ── 6. Search — type filter ──────────────────────────────────────────────
  section("Search — type filter")

  // Seed has tasks and notes; filter to notes only
  const searchNotes = await fetch(`${FN_BASE}/search?q=backend&type=note`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  const notesOnly: SearchBody = await searchNotes.json()
  ok("type=note returns only notes",  notesOnly.results.every(r => r.kind === "note"))

  // Filter to tasks only (searching for a seed task keyword)
  const searchTasks = await fetch(`${FN_BASE}/search?q=schema&type=task`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  const tasksOnly: SearchBody = await searchTasks.json()
  ok("type=task returns only tasks",  tasksOnly.results.every(r => r.kind === "task"))


  // ── 7. Search — limit ────────────────────────────────────────────────────
  section("Search — limit parameter")

  // Seed has some notes+tasks; with limit=1 we should get at most 1 result
  const searchLimited = await fetch(`${FN_BASE}/search?q=e&limit=1`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  const limited: SearchBody = await searchLimited.json()
  ok("limit=1 returns at most 1 result", limited.results.length <= 1)
  ok("limit echoed back",                limited.limit === 1)

  // Default limit is 20
  const searchDefault = await fetch(`${FN_BASE}/search?q=e`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  const defaultLimit: SearchBody = await searchDefault.json()
  ok("Default limit is 20",            defaultLimit.limit === 20)


  // ── 8. Search — validation ───────────────────────────────────────────────
  section("Search — validation")

  const searchNoQ = await fetch(`${FN_BASE}/search`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  ok("Missing q → 400",               searchNoQ.status === 400)

  const searchEmpty = await fetch(`${FN_BASE}/search?q=`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  ok("Empty q → 400",                 searchEmpty.status === 400)


  // ── 9. Search — RLS isolation ────────────────────────────────────────────
  section("Search — RLS isolation")

  // Alice's note "Backend architecture ideas" contains "backend"
  const aliceSearch = await fetch(`${FN_BASE}/search?q=architecture`, {
    headers: { Authorization: `Bearer ${aliceJwt}` },
  })
  const aliceResults: SearchBody = await aliceSearch.json()
  ok("Alice finds her note",          aliceResults.total > 0)

  // Bob searching for the same keyword finds nothing (not his data)
  const bobSearch = await fetch(`${FN_BASE}/search?q=architecture`, {
    headers: { Authorization: `Bearer ${bobJwt}` },
  })
  const bobResults: SearchBody = await bobSearch.json()
  ok("Bob finds nothing",             bobResults.total === 0)


  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(44)}`)
  console.log(`  Tests passed: ${passed}`)
  if (failed > 0) {
    console.error(`  Tests FAILED: ${failed}`)
    process.exit(1)
  } else {
    console.log("  All tests passed ✓")
  }
}

main().catch(err => { console.error("Unhandled error:", err); process.exit(1) })

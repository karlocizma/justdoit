import { createClient } from '@/lib/supabase/server'
import { SearchResults } from '@/components/search/SearchResults'

export const metadata = { title: 'Search — JustDoIt' }

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  if (!query) {
    return <SearchResults query="" notes={[]} tasks={[]} />
  }

  const supabase = await createClient()

  // Use the full-text search RPC if available, fall back to ilike
  const [{ data: notes }, { data: tasks }] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, content, color, updated_at')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .eq('is_archived', false)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('tasks')
      .select('id, title, notes, priority, due_date, completed_at, list_id, todo_lists(title, color)')
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return <SearchResults query={query} notes={notes ?? []} tasks={tasks ?? []} />
}

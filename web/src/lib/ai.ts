import { createClient } from './supabase/client'

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

async function callAI<T>(body: Record<string, string>): Promise<T> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Not authenticated')

  const resp = await fetch(`${BASE_URL}/functions/v1/ai`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await resp.json()
  if (!resp.ok) throw new Error((data as { error?: string }).error ?? 'AI request failed')
  return data as T
}

export async function summarizeNote(title: string, content: string): Promise<string> {
  const data = await callAI<{ summary: string }>({ action: 'summarize', title, content })
  return data.summary
}

export async function suggestTags(title: string, content: string): Promise<string[]> {
  const data = await callAI<{ tags: string[] }>({ action: 'suggest-tags', title, content })
  return data.tags
}

export async function generateTasks(title: string, content: string): Promise<string[]> {
  const data = await callAI<{ tasks: string[] }>({ action: 'generate-tasks', title, content })
  return data.tasks
}

export async function smartSearch(query: string): Promise<{ id: string; title: string; reason: string }[]> {
  const data = await callAI<{ results: { id: string; title: string; reason: string }[] }>({ action: 'smart-search', query })
  return data.results
}

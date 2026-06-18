import { createClient } from '@/lib/supabase/client'

export type WorkspaceMember = { id: string; display_name: string | null }

/**
 * Find which workspace members are @-mentioned in `text`. Matches `@<DisplayName>`
 * for each known member (display names can contain spaces, so we scan the member
 * list rather than parse free-form tokens). Excludes the author.
 */
export function findMentionedMembers(
  text: string,
  members: WorkspaceMember[],
  authorId: string,
): WorkspaceMember[] {
  const lower = text.toLowerCase()
  return members.filter(m => {
    if (m.id === authorId || !m.display_name) return false
    return lower.includes('@' + m.display_name.toLowerCase())
  })
}

/**
 * Create mention rows for newly @-mentioned members of a workspace note/task and
 * fire a best-effort push notification to each. Idempotent: the unique
 * (source_id, mentioned_user) constraint means re-saving never re-notifies, and
 * only genuinely new rows trigger a push. Online-only side effect.
 */
export async function syncMentions(opts: {
  workspaceId: string
  sourceType: 'note' | 'task'
  sourceId: string
  context: string
  text: string
  members: WorkspaceMember[]
  authorId: string
}): Promise<void> {
  const mentioned = findMentionedMembers(opts.text, opts.members, opts.authorId)
  if (mentioned.length === 0) return

  const supabase = createClient()
  const rows = mentioned.map(m => ({
    workspace_id: opts.workspaceId,
    mentioned_user: m.id,
    source_type: opts.sourceType,
    source_id: opts.sourceId,
    context: opts.context.slice(0, 200),
  }))

  // ignoreDuplicates → only rows new to (source_id, mentioned_user) are returned.
  const { data: inserted } = await supabase
    .from('mentions')
    .upsert(rows, { onConflict: 'source_id,mentioned_user', ignoreDuplicates: true })
    .select('mentioned_user')

  // Best-effort push for each newly created mention.
  const url = opts.sourceType === 'note' ? `/notes/${opts.sourceId}` : '/dashboard'
  await Promise.all(
    (inserted ?? []).map(row =>
      supabase.functions
        .invoke('push-send', {
          body: {
            user_id: row.mentioned_user,
            title: 'You were mentioned',
            body: opts.context ? `In “${opts.context}”` : 'You were mentioned in a workspace item',
            url,
          },
        })
        .catch(() => {}),
    ),
  )
}

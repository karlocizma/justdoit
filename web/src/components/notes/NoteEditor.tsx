'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import { createClient } from '@/lib/supabase/client'
import { updateNote, archiveNote, trashNote } from '@/lib/offline'
import { isOnline } from '@/lib/offline/status'
import { TemplateModal } from './TemplateModal'
import type { Template } from './TemplateModal'
import type { Database } from '@/lib/database.types'
import { summarizeNote, suggestTags, generateTasks } from '@/lib/ai'
import s from './NoteEditor.module.css'
import 'highlight.js/styles/github-dark.css'

type NoteUpdate = Database['public']['Tables']['notes']['Update']
type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; due_at?: string | null; updated_at: string; note_tags: NoteTag[] }

const COLORS = ['#8b7cff', '#5b9bff', '#48d1cc', '#4caf89', '#f5a623', '#e05c8b', '#e05c5c', null]

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
}))

export function NoteEditor({ note }: { note: Note }) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [pinned, setPinned] = useState(note.is_pinned)
  const [color, setColor] = useState<string | null>(note.color)
  const [dueAt, setDueAt] = useState<string | null>(note.due_at ?? null)
  const [showDuePicker, setShowDuePicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [tags, setTags] = useState<Tag[]>(note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? [])
  const [userTags, setUserTags] = useState<Tag[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [userTemplates, setUserTemplates] = useState<Template[]>([])
  const [saveTemplatePrompt, setSaveTemplatePrompt] = useState(false)
  const [templateName, setTemplateName] = useState('')
  // Backlinks
  const [backlinks, setBacklinks] = useState<{ id: string; title: string }[]>([])
  const [backlinksOpen, setBacklinksOpen] = useState(false)
  // AI features
  type AiResult =
    | { type: 'summary'; text: string }
    | { type: 'tags'; tags: string[] }
    | { type: 'tasks'; tasks: string[] }
  const [aiLoading, setAiLoading] = useState<'summarize' | 'suggest-tags' | 'generate-tasks' | null>(null)
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [addedTaskIndices, setAddedTaskIndices] = useState<Set<number>>(new Set())
  const [todoLists, setTodoLists] = useState<{ id: string; title: string; color: string | null }[]>([])
  const [aiTaskListId, setAiTaskListId] = useState('')
  // Focus mode
  const [focusMode, setFocusMode] = useState(false)
  // Attachment upload
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Note linking state
  const [linkSearch, setLinkSearch] = useState<string | null>(null)
  const [linkNotes, setLinkNotes] = useState<{ id: string; title: string }[]>([])
  const [linkIndex, setLinkIndex] = useState(0)
  const [allNotes, setAllNotes] = useState<{ id: string; title: string }[]>([])
  // Version history
  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState<{ id: string; title: string | null; content: string; created_at: string }[]>([])
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<string | null>(null)
  const lastVersionAt = useRef<number>(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { words, chars } = useMemo(() => {
    const trimmed = content.trim()
    return {
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      chars: content.length,
    }
  }, [content])

  // Load all note titles once (for linking)
  useEffect(() => {
    supabase.from('notes').select('id, title').is('deleted_at', null).eq('is_archived', false)
      .then(({ data }) => setAllNotes((data ?? []).filter(n => n.id !== note.id)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load user templates from profiles.settings
  useEffect(() => {
    supabase.from('profiles').select('settings').single()
      .then(({ data }) => {
        const templates = (data?.settings as { templates?: Template[] })?.templates ?? []
        setUserTemplates(templates)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load backlinks — notes whose content contains [[CurrentTitle]]
  useEffect(() => {
    if (!note.title) return
    supabase
      .from('notes')
      .select('id, title')
      .ilike('content', `%[[${note.title}]]%`)
      .is('deleted_at', null)
      .eq('is_archived', false)
      .then(({ data }) => setBacklinks((data ?? []).filter(n => n.id !== note.id)))
  }, [note.title]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build a title→id map for the preview renderer
  const noteTitleMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const n of allNotes) if (n.title) m[n.title.toLowerCase()] = n.id
    return m
  }, [allNotes])

  const previewHtml = useMemo(() => {
    if (mode !== 'preview') return ''
    // Replace [[Title]] with links before passing to marked
    const linked = (content as string).replace(/\[\[([^\]]+)\]\]/g, (_match, title: string) => {
      const id = noteTitleMap[title.toLowerCase()]
      if (id) return `[${title}](/notes/${id})`
      return `<span class="jd-wiki-missing">[[${title}]]</span>`
    })
    return marked(linked) as string
  }, [content, mode, noteTitleMap])

  const save = useCallback(async (patch: NoteUpdate) => {
    setSaving(true)
    // Optimistic local write + queued sync (works offline).
    await updateNote(note.id, patch)
    setSaving(false)
    // Version snapshots are an online-only side effect (resumes on next online edit).
    if (patch.content !== undefined && isOnline()) {
      const now = Date.now()
      if (now - lastVersionAt.current > 2 * 60 * 1000) {
        lastVersionAt.current = now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(supabase as any).from('note_versions').insert({
          note_id: note.id,
          title: patch.title ?? note.title,
          content: patch.content as string,
        }).then(() => {})
      }
    }
  }, [supabase, note.id, note.title])

  function scheduleSave(patch: NoteUpdate) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(patch), 800)
  }

  function insertFormat(type: string) {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const val = content
    const selected = val.slice(start, end)
    let newContent = val, newStart = start, newEnd = end

    if (type === 'bold') {
      const text = selected || 'bold'
      newContent = val.slice(0, start) + `**${text}**` + val.slice(end)
      newStart = start + 2; newEnd = newStart + text.length
    } else if (type === 'italic') {
      const text = selected || 'italic'
      newContent = val.slice(0, start) + `*${text}*` + val.slice(end)
      newStart = start + 1; newEnd = newStart + text.length
    } else if (type === 'code') {
      const text = selected || 'code'
      newContent = val.slice(0, start) + '`' + text + '`' + val.slice(end)
      newStart = start + 1; newEnd = newStart + text.length
    } else if (type === 'codeblock') {
      const text = selected || 'code'
      newContent = val.slice(0, start) + '```\n' + text + '\n```' + val.slice(end)
      newStart = start + 4; newEnd = newStart + text.length
    } else {
      const lineStart = val.lastIndexOf('\n', start - 1) + 1
      const prefix: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ', ul: '- ', quote: '> ' }
      const p = prefix[type] ?? ''
      if (val.slice(lineStart).startsWith(p)) {
        newContent = val.slice(0, lineStart) + val.slice(lineStart + p.length)
        newStart = Math.max(lineStart, start - p.length)
        newEnd = Math.max(lineStart, end - p.length)
      } else {
        newContent = val.slice(0, lineStart) + p + val.slice(lineStart)
        newStart = start + p.length; newEnd = end + p.length
      }
    }

    setContent(newContent)
    scheduleSave({ content: newContent })
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(newStart, newEnd) })
  }

  async function togglePin() {
    const next = !pinned
    setPinned(next)
    await save({ is_pinned: next })
  }

  async function setNoteColor(c: string | null) {
    setColor(c)
    await save({ color: c })
  }

  async function archive() {
    await archiveNote(note.id)
    router.push('/notes')
  }

  async function trash() {
    await trashNote(note.id)
    router.push('/notes')
  }

  async function loadUserTags() {
    if (userTags.length > 0) return
    const { data } = await supabase.from('tags').select('id, name, color').order('name')
    setUserTags(data ?? [])
  }

  async function addExistingTag(tag: Tag) {
    if (tags.some(t => t.id === tag.id)) return
    await supabase.from('note_tags').insert({ note_id: note.id, tag_id: tag.id })
    setTags(prev => [...prev, tag])
    setTagInput(''); setShowTagPicker(false)
  }

  async function createAndAddTag() {
    const name = tagInput.trim()
    if (!name) return
    const existing = userTags.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (existing) { await addExistingTag(existing); return }
    const { data: newTag } = await supabase
      .from('tags').insert({ name, color: '#6c63ff' }).select('id, name, color').single()
    if (newTag) {
      await supabase.from('note_tags').insert({ note_id: note.id, tag_id: newTag.id })
      setTags(prev => [...prev, newTag])
      setUserTags(prev => [...prev, newTag])
      setTagInput(''); setShowTagPicker(false)
    }
  }

  async function removeTag(tagId: string) {
    await supabase.from('note_tags').delete().eq('note_id', note.id).eq('tag_id', tagId)
    setTags(prev => prev.filter(t => t.id !== tagId))
  }

  async function updateTemplatesInProfile(templates: Template[]) {
    const { data: profile } = await supabase.from('profiles').select('settings, id').single()
    const merged = { ...(profile?.settings as object ?? {}), templates }
    await supabase.from('profiles').update({ settings: merged }).eq('id', profile!.id)
  }

  async function saveAsTemplate() {
    const name = templateName.trim()
    if (!name) return
    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name,
      description: '',
      content,
    }
    const updated = [...userTemplates, newTemplate]
    setUserTemplates(updated)
    setSaveTemplatePrompt(false)
    setTemplateName('')
    await updateTemplatesInProfile(updated)
  }

  async function deleteUserTemplate(id: string) {
    const updated = userTemplates.filter(t => t.id !== id)
    setUserTemplates(updated)
    await updateTemplatesInProfile(updated)
  }

  async function handleSummarize() {
    if (!content.trim()) return
    setAiLoading('summarize'); setAiResult(null); setAiError(null)
    try {
      const text = await summarizeNote(title, content)
      setAiResult({ type: 'summary', text })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Summarize failed')
    } finally {
      setAiLoading(null)
    }
  }

  async function handleSuggestTags() {
    if (!content.trim()) return
    setAiLoading('suggest-tags'); setAiResult(null); setAiError(null)
    try {
      const tags = await suggestTags(title, content)
      setAiResult({ type: 'tags', tags })
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Tag suggestion failed')
    } finally {
      setAiLoading(null)
    }
  }

  async function handleGenerateTasks() {
    if (!content.trim()) return
    setAiError(null)
    let lists = todoLists
    if (lists.length === 0) {
      const { data } = await supabase
        .from('todo_lists').select('id, title, color')
        .eq('is_archived', false).order('sort_order')
      lists = data ?? []
      setTodoLists(lists)
      if (lists.length > 0 && !aiTaskListId) setAiTaskListId(lists[0].id)
    }
    setAiLoading('generate-tasks'); setAiResult(null)
    try {
      const tasks = await generateTasks(title, content)
      setAiResult({ type: 'tasks', tasks })
      setAddedTaskIndices(new Set())
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Task generation failed')
    } finally {
      setAiLoading(null)
    }
  }

  async function addAiTagToNote(tagName: string) {
    const normalized = tagName.toLowerCase().trim()
    if (tags.some(t => t.name.toLowerCase() === normalized)) return
    const { data: found } = await supabase.from('tags').select('id, name, color').ilike('name', normalized).limit(1)
    const existing = found?.[0]
    if (existing) {
      await supabase.from('note_tags').insert({ note_id: note.id, tag_id: existing.id })
      setTags(prev => [...prev, existing])
      setUserTags(prev => prev.some(t => t.id === existing.id) ? prev : [...prev, existing])
    } else {
      const { data: newTag } = await supabase
        .from('tags').insert({ name: normalized, color: '#6c63ff' }).select('id, name, color').single()
      if (newTag) {
        await supabase.from('note_tags').insert({ note_id: note.id, tag_id: newTag.id })
        setTags(prev => [...prev, newTag])
        setUserTags(prev => [...prev, newTag])
      }
    }
  }

  async function addAiTask(taskTitle: string, idx: number) {
    const listId = aiTaskListId || todoLists[0]?.id
    if (!listId) return
    await supabase.from('tasks').insert({ title: taskTitle, list_id: listId, sort_order: 9999 })
    setAddedTaskIndices(prev => new Set([...prev, idx]))
  }

  async function addAllAiTasks(tasks: string[]) {
    const listId = aiTaskListId || todoLists[0]?.id
    if (!listId) return
    for (const t of tasks) {
      await supabase.from('tasks').insert({ title: t, list_id: listId, sort_order: 9999 })
    }
    setAiResult(null)
  }

  useEffect(() => {
    if (!showTagPicker) return
    function handleClick(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showTagPicker])

  const filteredTags = userTags.filter(
    t => !tags.some(nt => nt.id === t.id) && t.name.toLowerCase().includes(tagInput.toLowerCase())
  )

  function detectLinkTrigger(value: string, cursorPos: number) {
    const before = value.slice(0, cursorPos)
    const match = before.match(/\[\[([^\][]*)$/)
    if (match) {
      const query = match[1]
      setLinkSearch(query)
      const filtered = allNotes.filter(n =>
        n.title && n.title.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
      setLinkNotes(filtered)
      setLinkIndex(0)
    } else {
      setLinkSearch(null)
    }
  }

  useEffect(() => {
    document.documentElement.dataset.focus = focusMode ? 'true' : 'false'
    return () => { delete document.documentElement.dataset.focus }
  }, [focusMode])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        setFocusMode(f => !f)
      }
      if (e.key === 'Escape' && focusMode) setFocusMode(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [focusMode])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${note.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('note-attachments').upload(path, file)
      if (error) throw error
      const { data: urlData } = supabase.storage.from('note-attachments').getPublicUrl(path)
      const isImage = file.type.startsWith('image/')
      const md = isImage ? `![${file.name}](${urlData.publicUrl})` : `[${file.name}](${urlData.publicUrl})`
      const ta = textareaRef.current
      const pos = ta?.selectionStart ?? content.length
      const newContent = content.slice(0, pos) + '\n' + md + '\n' + content.slice(pos)
      setContent(newContent)
      scheduleSave({ content: newContent })
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function openHistory() {
    setShowHistory(true)
    setPreviewVersion(null)
    if (!versionsLoaded) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('note_versions')
        .select('id, title, content, created_at')
        .eq('note_id', note.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setVersions(data ?? [])
      setVersionsLoaded(true)
    }
  }

  async function restoreVersion(v: { title: string | null; content: string }) {
    const newTitle = v.title ?? title
    const newContent = v.content
    setTitle(newTitle)
    setContent(newContent)
    await save({ title: newTitle, content: newContent })
    setShowHistory(false)
    setPreviewVersion(null)
  }

  function insertNoteLink(n: { id: string; title: string }) {
    const ta = textareaRef.current
    if (!ta) return
    const before = content.slice(0, ta.selectionStart)
    const after = content.slice(ta.selectionStart)
    // Replace the partial [[query with [[Full Title]]
    const replaced = before.replace(/\[\[([^\][]*)$/, `[[${n.title}]]`)
    const newContent = replaced + after
    setContent(newContent)
    scheduleSave({ content: newContent })
    setLinkSearch(null)
    const newPos = replaced.length
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(newPos, newPos) })
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar} data-print="hide">
        <button className={s.back} onClick={() => router.push('/notes')}>
          <ChevronLeftIcon /> Notes
        </button>
        <div className={s.toolbarRight}>
          <span className={s.saveIndicator}>{saving ? 'Saving…' : 'Saved'}</span>
          <button className={`${s.toolBtn} ${pinned ? s.active : ''}`} onClick={togglePin} title={pinned ? 'Unpin' : 'Pin'}>
            <PinIcon />
          </button>
          <div className={s.colorPicker}>
            {COLORS.map(c => (
              <button
                key={c ?? 'none'}
                className={`${s.colorSwatch} ${color === c ? s.colorActive : ''}`}
                style={{ background: c ?? 'var(--jd-surface-2)', border: c ? undefined : '1px dashed var(--jd-border)' }}
                onClick={() => setNoteColor(c)}
                title={c ?? 'No color'}
              />
            ))}
          </div>
          <div className={s.dueWrap}>
            <button
              className={`${s.toolBtn} ${dueAt ? s.active : ''}`}
              onClick={() => setShowDuePicker(v => !v)}
              title={dueAt ? `Due: ${formatDueLabel(dueAt)}` : 'Set due date'}
            >
              <DueDateIcon />
              {dueAt && <span className={s.dueBadge}>{formatDueLabel(dueAt)}</span>}
            </button>
            {showDuePicker && (
              <>
                <div className={s.dueOverlay} onClick={() => setShowDuePicker(false)} />
                <div className={s.duePicker}>
                  <input
                    type="datetime-local"
                    className={s.dueDateInput}
                    value={dueAt ? dueAt.slice(0, 16) : ''}
                    onChange={async e => {
                      const val = e.target.value ? new Date(e.target.value).toISOString() : null
                      setDueAt(val)
                      await save({ due_at: val } as NoteUpdate)
                    }}
                  />
                  {dueAt && (
                    <button className={s.dueClearBtn} onClick={async () => {
                      setDueAt(null)
                      setShowDuePicker(false)
                      await save({ due_at: null } as NoteUpdate)
                    }}>
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          <button className={s.toolBtn} onClick={archive} title="Archive"><ArchiveIcon /></button>
          <button className={`${s.toolBtn} ${s.danger}`} onClick={trash} title="Trash"><TrashIcon /></button>
          <button className={s.toolBtn} onClick={() => exportNote(title, content)} title="Download as .md"><DownloadIcon /></button>
          <button
            className={`${s.toolBtn} ${showHistory ? s.active : ''}`}
            onClick={() => showHistory ? setShowHistory(false) : openHistory()}
            title="Version history"
          >
            <HistoryIcon />
          </button>
          <button
            className={`${s.toolBtn} ${focusMode ? s.active : ''}`}
            onClick={() => setFocusMode(f => !f)}
            title={focusMode ? 'Exit focus mode (F)' : 'Focus mode (F)'}
          >
            <FocusIcon />
          </button>
          <div className={s.modeTabs}>
            <button className={`${s.modeTab} ${mode === 'edit' ? s.modeActive : ''}`} onClick={() => setMode('edit')}>Edit</button>
            <button className={`${s.modeTab} ${mode === 'preview' ? s.modeActive : ''}`} onClick={() => setMode('preview')}>Preview</button>
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <div className={s.formatBar} data-print="hide">
          <button className={s.fmtBtn} onClick={() => insertFormat('h1')}>H1</button>
          <button className={s.fmtBtn} onClick={() => insertFormat('h2')}>H2</button>
          <button className={s.fmtBtn} onClick={() => insertFormat('h3')}>H3</button>
          <span className={s.fmtSep} />
          <button className={s.fmtBtn} onClick={() => insertFormat('bold')} style={{ fontWeight: 700 }}>B</button>
          <button className={s.fmtBtn} onClick={() => insertFormat('italic')} style={{ fontStyle: 'italic' }}>I</button>
          <span className={s.fmtSep} />
          <button className={s.fmtBtn} onClick={() => insertFormat('code')} style={{ fontFamily: 'var(--jd-font-mono)', fontSize: 11 }}>`code`</button>
          <button className={s.fmtBtn} onClick={() => insertFormat('codeblock')} style={{ fontFamily: 'var(--jd-font-mono)', fontSize: 11 }}>```</button>
          <span className={s.fmtSep} />
          <button className={s.fmtBtn} onClick={() => insertFormat('ul')}>• List</button>
          <button className={s.fmtBtn} onClick={() => insertFormat('quote')}>&ldquo; Quote</button>
          <span className={s.fmtSep} />
          <button className={s.fmtBtn} onClick={() => setShowTemplates(true)}>Templates</button>
          <span className={s.fmtSep} />
          {saveTemplatePrompt ? (
            <div className={s.saveTemplateInline}>
              <input
                className={s.saveTemplateInput}
                placeholder="Template name…"
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveAsTemplate()
                  if (e.key === 'Escape') { setSaveTemplatePrompt(false); setTemplateName('') }
                }}
                autoFocus
              />
              <button className={s.fmtBtn} onClick={saveAsTemplate} disabled={!templateName.trim()}>Save</button>
              <button className={s.fmtBtn} onClick={() => { setSaveTemplatePrompt(false); setTemplateName('') }}>Cancel</button>
            </div>
          ) : (
            <button className={s.fmtBtn} onClick={() => setSaveTemplatePrompt(true)}>Save as template</button>
          )}
          <span className={s.fmtSep} />
          <button
            className={`${s.fmtBtn} ${s.aiFmtBtn}`}
            onClick={handleSummarize}
            disabled={aiLoading !== null || !content.trim()}
            title="Summarize this note with AI"
          >
            {aiLoading === 'summarize' ? '…' : '✦ Summarize'}
          </button>
          <button
            className={`${s.fmtBtn} ${s.aiFmtBtn}`}
            onClick={handleSuggestTags}
            disabled={aiLoading !== null || !content.trim()}
            title="Suggest tags with AI"
          >
            {aiLoading === 'suggest-tags' ? '…' : '✦ Tags'}
          </button>
          <button
            className={`${s.fmtBtn} ${s.aiFmtBtn}`}
            onClick={handleGenerateTasks}
            disabled={aiLoading !== null || !content.trim()}
            title="Extract action items with AI"
          >
            {aiLoading === 'generate-tasks' ? '…' : '✦ Tasks'}
          </button>
          <span className={s.fmtSep} />
          <button
            className={s.fmtBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Attach file or image"
          >
            {uploading ? '…' : '📎 Attach'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      )}

      {aiError && (
        <div className={s.aiError}>
          <span>{aiError}</span>
          <button className={s.aiDismiss} onClick={() => setAiError(null)}>×</button>
        </div>
      )}

      {aiResult && (
        <div className={s.aiPanel}>
          <div className={s.aiPanelHeader}>
            <span className={s.aiPanelLabel}>
              {aiResult.type === 'summary' && '✦ Summary'}
              {aiResult.type === 'tags' && '✦ Suggested tags'}
              {aiResult.type === 'tasks' && '✦ Action items'}
            </span>
            <button className={s.aiDismiss} onClick={() => setAiResult(null)}>×</button>
          </div>

          {aiResult.type === 'summary' && (
            <p className={s.aiSummaryText}>{aiResult.text}</p>
          )}

          {aiResult.type === 'tags' && (
            <div className={s.aiTagList}>
              {aiResult.tags.length === 0 && <span className={s.aiEmpty}>No tags suggested.</span>}
              {aiResult.tags.map(tag => {
                const already = tags.some(t => t.name.toLowerCase() === tag.toLowerCase())
                return (
                  <button
                    key={tag}
                    className={`${s.aiTagChip} ${already ? s.aiTagAdded : ''}`}
                    onClick={() => !already && addAiTagToNote(tag)}
                    disabled={already}
                  >
                    {tag} {already ? '✓' : '+'}
                  </button>
                )
              })}
            </div>
          )}

          {aiResult.type === 'tasks' && (
            <div className={s.aiTaskSection}>
              {aiResult.tasks.length === 0 && <span className={s.aiEmpty}>No action items found.</span>}
              <ul className={s.aiTaskList}>
                {aiResult.tasks.map((t, i) => (
                  <li key={i} className={s.aiTaskItem}>
                    <span className={s.aiTaskBullet}>{addedTaskIndices.has(i) ? '✓' : '○'}</span>
                    <span className={`${s.aiTaskTitle} ${addedTaskIndices.has(i) ? s.aiTaskDone : ''}`}>{t}</span>
                    <button
                      className={s.aiAddSingleBtn}
                      onClick={() => addAiTask(t, i)}
                      disabled={addedTaskIndices.has(i) || !aiTaskListId}
                    >
                      {addedTaskIndices.has(i) ? 'Added' : 'Add'}
                    </button>
                  </li>
                ))}
              </ul>
              {todoLists.length === 0 && (
                <span className={s.aiEmpty}>Create a task list first to add tasks.</span>
              )}
              {todoLists.length > 0 && aiResult.tasks.length > 0 && (
                <div className={s.aiTaskActions}>
                  <select
                    className={s.aiListSelect}
                    value={aiTaskListId}
                    onChange={e => setAiTaskListId(e.target.value)}
                  >
                    {todoLists.map(l => (
                      <option key={l.id} value={l.id}>{l.title}</option>
                    ))}
                  </select>
                  <button
                    className={s.aiAddAllBtn}
                    onClick={() => addAllAiTasks(aiResult.tasks)}
                    disabled={!aiTaskListId || addedTaskIndices.size === aiResult.tasks.length}
                  >
                    Add all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {color && <div className={s.colorStripe} style={{ background: color }} />}

      <div className={s.editor}>
        <input
          className={s.titleInput}
          placeholder="Title"
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleSave({ title: e.target.value }) }}
        />

        {mode === 'edit' ? (
          <div className={s.contentWrap}>
          <textarea
            ref={textareaRef}
            className={s.contentArea}
            placeholder="Start writing… (Markdown supported, [[ to link notes)"
            value={content}
            onChange={e => {
              const val = e.target.value
              setContent(val)
              scheduleSave({ content: val })
              detectLinkTrigger(val, e.target.selectionStart)
            }}
            onKeyDown={e => {
              if (linkSearch === null) return
              if (e.key === 'ArrowDown') { e.preventDefault(); setLinkIndex(i => Math.min(i + 1, linkNotes.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setLinkIndex(i => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter' && linkNotes.length > 0) { e.preventDefault(); insertNoteLink(linkNotes[linkIndex]) }
              else if (e.key === 'Escape') { setLinkSearch(null) }
            }}
          />
          {linkSearch !== null && linkNotes.length > 0 && (
            <div className={s.linkDropdown}>
              {linkNotes.map((n, i) => (
                <button
                  key={n.id}
                  className={`${s.linkItem} ${i === linkIndex ? s.linkItemActive : ''}`}
                  onMouseDown={() => insertNoteLink(n)}
                >
                  <LinkIcon /> {n.title || 'Untitled'}
                </button>
              ))}
            </div>
          )}
          </div>
        ) : (
          <div
            className={s.previewContent}
            dangerouslySetInnerHTML={{
              __html: previewHtml || '<p class="jd-preview-empty">Nothing to preview yet.</p>',
            }}
          />
        )}

        <div className={s.tagRow}>
          {tags.map(tag => (
            <span key={tag.id} className={s.tag} style={tag.color ? { color: tag.color, background: `${tag.color}22` } : undefined}>
              {tag.name}
              <button className={s.tagRemove} onClick={() => removeTag(tag.id)}>×</button>
            </span>
          ))}
          <div className={s.tagPickerWrapper} ref={tagPickerRef}>
            <input
              className={s.tagInput}
              placeholder="+ Add tag"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onFocus={() => { loadUserTags(); setShowTagPicker(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); createAndAddTag() }
                if (e.key === 'Escape') { setShowTagPicker(false); setTagInput('') }
              }}
            />
            {showTagPicker && (filteredTags.length > 0 || tagInput.trim()) && (
              <div className={s.tagDropdown}>
                {filteredTags.map(tag => (
                  <button key={tag.id} className={s.tagDropdownItem} onMouseDown={() => addExistingTag(tag)}>
                    <span className={s.tagDropdownDot} style={{ background: tag.color ?? '#6c63ff' }} />
                    {tag.name}
                  </button>
                ))}
                {tagInput.trim() && !userTags.some(t => t.name.toLowerCase() === tagInput.trim().toLowerCase()) && (
                  <button className={s.tagDropdownItem} onMouseDown={createAndAddTag}>
                    <span style={{ color: 'var(--jd-fg-dim)', fontSize: 11 }}>Create</span> &ldquo;{tagInput.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={s.footer}>
        <span className={s.wordCount}>
          {words} word{words !== 1 ? 's' : ''} · {chars} character{chars !== 1 ? 's' : ''}
        </span>
      </div>

      {showHistory && (
        <div className={s.historyPanel} data-print="hide">
          <div className={s.historyHeader}>
            <span className={s.historyTitle}>Version history</span>
            <button className={s.aiDismiss} onClick={() => { setShowHistory(false); setPreviewVersion(null) }}>×</button>
          </div>
          {!versionsLoaded ? (
            <div className={s.historyEmpty}>Loading…</div>
          ) : versions.length === 0 ? (
            <div className={s.historyEmpty}>No saved versions yet. Versions are captured automatically while you write.</div>
          ) : (
            <div className={s.historyList}>
              {versions.map(v => (
                <div key={v.id} className={`${s.historyItem} ${previewVersion === v.id ? s.historyItemActive : ''}`}>
                  <button className={s.historyItemBtn} onClick={() => setPreviewVersion(pv => pv === v.id ? null : v.id)}>
                    <span className={s.historyTime}>{formatVersionDate(v.created_at)}</span>
                    <span className={s.historySnippet}>{v.content.slice(0, 60).replace(/\n/g, ' ')}</span>
                  </button>
                  {previewVersion === v.id && (
                    <div className={s.historyPreview}>
                      <div className={s.historyPreviewContent}>{v.content.slice(0, 400)}{v.content.length > 400 ? '…' : ''}</div>
                      <button className={s.saveBtn} onClick={() => restoreVersion(v)}>Restore this version</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={s.backlinksSection}>
        <button className={s.backlinksToggle} onClick={() => setBacklinksOpen(o => !o)}>
          <BacklinkIcon />
          <span>Backlinks</span>
          <span className={s.backlinksCount}>{backlinks.length}</span>
          <ChevronSmIcon open={backlinksOpen} />
        </button>
        {backlinksOpen && (
          <div className={s.backlinksList}>
            {backlinks.length === 0 ? (
              <span className={s.backlinksEmpty}>No notes link to this one yet.</span>
            ) : (
              backlinks.map(n => (
                <a key={n.id} href={`/notes/${n.id}`} className={s.backlinkItem}>
                  <BacklinkIcon />
                  {n.title || 'Untitled'}
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {showTemplates && (
        <TemplateModal
          hasContent={content.trim().length > 0}
          onSelect={newContent => {
            setContent(newContent)
            scheduleSave({ content: newContent })
          }}
          onClose={() => setShowTemplates(false)}
          userTemplates={userTemplates}
          onDeleteUserTemplate={deleteUserTemplate}
        />
      )}
    </div>
  )
}

function formatDueLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = Math.floor((d.getTime() - today.setHours(0,0,0,0)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 0 && diff < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function exportNote(noteTitle: string, noteContent: string) {
  const md = `# ${noteTitle}\n\n${noteContent}`
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${noteTitle || 'note'}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function ChevronLeftIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function PinIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function ArchiveIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> }
function TrashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }
function LinkIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> }
function DownloadIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function BacklinkIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg> }
function DueDateIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function formatVersionDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function HistoryIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg> }
function FocusIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3"/><path d="M21 8V5a2 2 0 00-2-2h-3"/><path d="M3 16v3a2 2 0 002 2h3"/><path d="M16 21h3a2 2 0 002-2v-3"/></svg> }
function ChevronSmIcon({ open }: { open: boolean }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms', flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
}

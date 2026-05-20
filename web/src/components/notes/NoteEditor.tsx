'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { marked } from 'marked'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/database.types'
import s from './NoteEditor.module.css'

type NoteUpdate = Database['public']['Tables']['notes']['Update']
type Tag = { id: string; name: string; color: string | null }
type NoteTag = { tags: Tag }
type Note = { id: string; title: string; content: string; color: string | null; is_pinned: boolean; updated_at: string; note_tags: NoteTag[] }

const COLORS = ['#8b7cff', '#5b9bff', '#48d1cc', '#4caf89', '#f5a623', '#e05c8b', '#e05c5c', null]

export function NoteEditor({ note }: { note: Note }) {
  const router = useRouter()
  const supabase = createClient()
  const [title, setTitle] = useState(note.title ?? '')
  const [content, setContent] = useState(note.content ?? '')
  const [pinned, setPinned] = useState(note.is_pinned)
  const [color, setColor] = useState<string | null>(note.color)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [tags, setTags] = useState<Tag[]>(note.note_tags?.map(nt => nt.tags).filter(Boolean) ?? [])
  const [userTags, setUserTags] = useState<Tag[]>([])
  const [tagInput, setTagInput] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
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

  const previewHtml = useMemo(() => {
    if (mode !== 'preview') return ''
    return marked(content) as string
  }, [content, mode])

  const save = useCallback(async (patch: NoteUpdate) => {
    setSaving(true)
    await supabase.from('notes').update(patch).eq('id', note.id)
    setSaving(false)
  }, [supabase, note.id])

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
    await supabase.from('notes').update({ is_archived: true }).eq('id', note.id)
    router.push('/notes')
  }

  async function trash() {
    await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', note.id)
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

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
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
          <button className={s.toolBtn} onClick={archive} title="Archive"><ArchiveIcon /></button>
          <button className={`${s.toolBtn} ${s.danger}`} onClick={trash} title="Trash"><TrashIcon /></button>
          <div className={s.modeTabs}>
            <button className={`${s.modeTab} ${mode === 'edit' ? s.modeActive : ''}`} onClick={() => setMode('edit')}>Edit</button>
            <button className={`${s.modeTab} ${mode === 'preview' ? s.modeActive : ''}`} onClick={() => setMode('preview')}>Preview</button>
          </div>
        </div>
      </div>

      {mode === 'edit' && (
        <div className={s.formatBar}>
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
          <textarea
            ref={textareaRef}
            className={s.contentArea}
            placeholder="Start writing… (Markdown supported)"
            value={content}
            onChange={e => { setContent(e.target.value); scheduleSave({ content: e.target.value }) }}
          />
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
    </div>
  )
}

function ChevronLeftIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg> }
function PinIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
function ArchiveIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg> }
function TrashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> }

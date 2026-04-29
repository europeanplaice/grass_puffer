import { useState, useEffect, useCallback } from 'react'
import type { DiaryEntry } from '../types'

interface Props {
  date: string
  getContent: (date: string) => Promise<DiaryEntry | null>
  onSave: (date: string, content: string) => Promise<void>
  onDelete: (date: string) => Promise<void>
}

export function EntryEditor({ date, getContent, onSave, onDelete }: Props) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setLoading(true)
    setText('')
    setSavedText('')
    setStatus('')
    getContent(date).then(entry => {
      const t = entry?.content ?? ''
      setText(t)
      setSavedText(t)
    }).catch(() => setStatus('Failed to load entry.')).finally(() => setLoading(false))
  }, [date, getContent])

  const isDirty = text !== savedText

  const save = useCallback(async () => {
    setSaving(true)
    setStatus('')
    try {
      await onSave(date, text)
      setSavedText(text)
      setStatus('Saved.')
    } catch {
      setStatus('Save failed.')
    } finally {
      setSaving(false)
    }
  }, [date, text, onSave])

  const del = async () => {
    if (!confirm('Delete this entry?')) return
    await onDelete(date)
  }

  // Auto-save on Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty) save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDirty, save])

  return (
    <div className="editor">
      <div className="editor-header">
        <h2>{date}</h2>
        <div className="editor-actions">
          {status && <span className="editor-status">{status}</span>}
          <button onClick={save} disabled={saving || !isDirty}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {savedText && <button className="btn-delete" onClick={del}>Delete</button>}
        </div>
      </div>
      {loading ? (
        <div className="editor-loading">Loading…</div>
      ) : (
        <textarea
          className="editor-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Write your thoughts…"
          autoFocus
        />
      )}
    </div>
  )
}

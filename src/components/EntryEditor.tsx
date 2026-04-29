import { useState, useEffect, useCallback } from 'react'
import type { DiaryEntry } from '../types'

interface Props {
  date: string
  getContent: (date: string) => Promise<DiaryEntry | null>
  onSave: (date: string, content: string) => Promise<void>
  onDelete: (date: string) => Promise<void>
  onMenuClick: () => void
}

export function EntryEditor({ date, getContent, onSave, onDelete, onMenuClick }: Props) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')

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
    setDeleteInput('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    setShowDeleteModal(false)
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
    <>
    {showDeleteModal && (
      <div className="delete-modal-overlay" onClick={() => setShowDeleteModal(false)}>
        <div className="delete-modal" onClick={e => e.stopPropagation()}>
          <h3>Delete entry?</h3>
          <p>The entry for {date} will be permanently deleted and cannot be undone.</p>
          <p className="delete-modal-hint">Type <strong>confirm</strong> to proceed</p>
          <input
            className="delete-modal-input"
            value={deleteInput}
            onChange={e => setDeleteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && deleteInput === 'confirm') confirmDelete() }}
            autoFocus
            placeholder="confirm"
          />
          <div className="delete-modal-actions">
            <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
            <button
              className="btn-delete"
              onClick={confirmDelete}
              disabled={deleteInput !== 'confirm'}
            >Delete</button>
          </div>
        </div>
      </div>
    )}
    <div className="editor">
      <div className="editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button className="btn-menu" onClick={onMenuClick} title="Open menu">☰</button>
          <h2>{date}</h2>
        </div>
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
    </>
  )
}

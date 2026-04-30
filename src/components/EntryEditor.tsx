import { useState, useEffect, useCallback } from 'react'
import { EntryConflictError } from '../hooks/useDiary'
import type { LoadedDiaryEntry } from '../types'

interface Props {
  date: string
  getContent: (date: string) => Promise<LoadedDiaryEntry | null>
  onSave: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  onDelete: (date: string) => Promise<void>
  onMenuClick: () => void
}

export function EntryEditor({ date, getContent, onSave, onDelete, onMenuClick }: Props) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [baseVersion, setBaseVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [hasConflict, setHasConflict] = useState(false)
  const [conflictRemote, setConflictRemote] = useState<LoadedDiaryEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setText('')
    setSavedText('')
    setBaseVersion(null)
    setStatus('')
    setHasConflict(false)
    setConflictRemote(null)
    getContent(date).then(entry => {
      if (cancelled) return
      const t = entry?.entry.content ?? ''
      setText(t)
      setSavedText(t)
      setBaseVersion(entry?.meta.version ?? null)
    }).catch(() => {
      if (!cancelled) setStatus('Failed to load entry.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [date, getContent])

  const isDirty = text !== savedText

  const save = useCallback(async () => {
    setSaving(true)
    setStatus('')
    setHasConflict(false)
    setConflictRemote(null)
    try {
      const saved = await onSave(date, text, baseVersion)
      setSavedText(text)
      setBaseVersion(saved.meta.version ?? null)
      setStatus('Saved.')
    } catch (e) {
      if (e instanceof EntryConflictError) {
        setHasConflict(true)
        setConflictRemote(e.remote)
        setStatus('This entry changed on another device.')
      } else {
        setStatus('Save failed.')
      }
    } finally {
      setSaving(false)
    }
  }, [date, text, baseVersion, onSave])

  const loadRemote = () => {
    const remoteText = conflictRemote?.entry.content ?? ''
    setText(remoteText)
    setSavedText(remoteText)
    setBaseVersion(conflictRemote?.meta.version ?? null)
    setHasConflict(false)
    setConflictRemote(null)
    setStatus(conflictRemote ? 'Loaded latest version.' : 'Remote entry was deleted.')
  }

  const keepLocal = () => {
    setHasConflict(false)
    setConflictRemote(null)
    setStatus('Local edits kept.')
  }

  const overwriteRemote = async () => {
    setSaving(true)
    setStatus('')
    try {
      const saved = await onSave(date, text, conflictRemote?.meta.version ?? baseVersion, true)
      setSavedText(text)
      setBaseVersion(saved.meta.version ?? null)
      setHasConflict(false)
      setConflictRemote(null)
      setStatus('Saved.')
    } catch {
      setStatus('Save failed.')
    } finally {
      setSaving(false)
    }
  }

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
          <button
            className={`btn-save${saving ? ' btn-saving' : ''}`}
            onClick={save}
            disabled={saving || !isDirty}
            aria-busy={saving}
          >
            {saving && <span className="btn-saving-spinner" aria-hidden="true" />}
            <span>{saving ? 'Saving…' : 'Save'}</span>
          </button>
          {savedText && <button className="btn-delete" onClick={del}>Delete</button>}
        </div>
      </div>
      {hasConflict && (
        <div className="conflict-panel">
          <div>
            <strong>This entry was updated on another device.</strong>
            <p>{conflictRemote ? 'Load the latest version, keep editing locally, or overwrite the remote entry.' : 'The remote entry was deleted. Keep editing locally or create it again by overwriting.'}</p>
          </div>
          <div className="conflict-actions">
            <button onClick={loadRemote}>{conflictRemote ? 'Load latest' : 'Clear local'}</button>
            <button onClick={keepLocal}>Keep local</button>
            <button className="btn-delete" onClick={overwriteRemote} disabled={saving}>Overwrite</button>
          </div>
        </div>
      )}
      {loading ? (
        <div className="entry-skeleton" aria-label="Loading entry" aria-live="polite">
          <div className="entry-skeleton-row short" />
          <div className="entry-skeleton-row" />
          <div className="entry-skeleton-row medium" />
          <div className="entry-skeleton-row" />
          <div className="entry-skeleton-row long" />
          <div className="entry-skeleton-row medium" />
        </div>
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

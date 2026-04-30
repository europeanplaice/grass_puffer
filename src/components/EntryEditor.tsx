import { useState, useEffect, useCallback, useRef } from 'react'
import { EntryConflictError } from '../hooks/useDiary'
import { saveDraft, loadDraft, clearDraft } from '../utils/draftStorage'
import type { LoadedDiaryEntry } from '../types'

interface Props {
  date: string
  getContent: (date: string) => Promise<LoadedDiaryEntry | null>
  onSave: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  onDelete: (date: string) => Promise<void>
  onMenuClick: () => void
  onDirtyChange: (isDirty: boolean) => void
  autoSave: boolean
  onAutoSaveToggle: () => void
  onPrevDay: () => void
  onNextDay: () => void
}

const SAVED_STATUS = 'Saved.'
const SAVED_STATUS_VISIBLE_MS = 1600
const SAVED_STATUS_EXIT_MS = 220
const DRAFT_DEBOUNCE_MS = 300
const AUTO_SAVE_MS = 3000

export function EntryEditor({ date, getContent, onSave, onDelete, onMenuClick, onDirtyChange, autoSave, onAutoSaveToggle, onPrevDay, onNextDay }: Props) {
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
  const [showDraftBanner, setShowDraftBanner] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<string | null>(null)

  // Use a ref to track the latest onSave without restarting debounce timers
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  const textRef = useRef(text)
  const savedTextRef = useRef(savedText)
  const baseVersionRef = useRef(baseVersion)
  const savingRef = useRef(saving)
  const hasConflictRef = useRef(hasConflict)
  const loadingRef = useRef(loading)

  useEffect(() => { textRef.current = text }, [text])
  useEffect(() => { savedTextRef.current = savedText }, [savedText])
  useEffect(() => { baseVersionRef.current = baseVersion }, [baseVersion])
  useEffect(() => { savingRef.current = saving }, [saving])
  useEffect(() => { hasConflictRef.current = hasConflict }, [hasConflict])
  useEffect(() => { loadingRef.current = loading }, [loading])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setText('')
    setSavedText('')
    setBaseVersion(null)
    setStatus('')
    setHasConflict(false)
    setConflictRemote(null)
    setShowDraftBanner(false)
    setPendingDraft(null)
    getContent(date).then(entry => {
      if (cancelled) return
      const driveText = entry?.entry.content ?? ''
      const draft = loadDraft(date)
      if (draft !== null && draft !== driveText) {
        setPendingDraft(draft)
        setShowDraftBanner(true)
        setText(driveText)
        setSavedText(driveText)
      } else {
        setText(driveText)
        setSavedText(driveText)
      }
      setBaseVersion(entry?.meta.version ?? null)
    }).catch(() => {
      if (!cancelled) setStatus('Failed to load entry.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [date, getContent])

  const isDirty = text !== savedText

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  const save = useCallback(async (explicit = true) => {
    if (savingRef.current) return
    setSaving(true)
    if (explicit) {
      setStatus('')
      setHasConflict(false)
      setConflictRemote(null)
    }
    try {
      const currentText = textRef.current
      const saved = await onSaveRef.current(date, currentText, baseVersionRef.current)
      setSavedText(currentText)
      setBaseVersion(saved.meta.version ?? null)
      clearDraft(date)
      if (explicit) setStatus(SAVED_STATUS)
    } catch (e) {
      if (!explicit) {
        // Auto-save silently swallows errors; conflicts surface on next manual save
        console.error('Auto-save failed:', e)
        return
      }
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
  }, [date])

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
      const currentText = textRef.current
      const saved = await onSaveRef.current(date, currentText, conflictRemote?.meta.version ?? baseVersionRef.current, true)
      setSavedText(currentText)
      setBaseVersion(saved.meta.version ?? null)
      clearDraft(date)
      setHasConflict(false)
      setConflictRemote(null)
      setStatus(SAVED_STATUS)
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

  // Draft restore actions
  const restoreDraft = () => {
    if (pendingDraft === null) return
    setText(pendingDraft)
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  const discardDraft = () => {
    clearDraft(date)
    setShowDraftBanner(false)
    setPendingDraft(null)
  }

  // Debounced local draft save
  useEffect(() => {
    if (!isDirty) return
    const id = window.setTimeout(() => saveDraft(date, textRef.current), DRAFT_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [text, isDirty, date])

  // Drive auto-save after 3s of being dirty (only when auto-save is enabled)
  useEffect(() => {
    if (!autoSave || !isDirty) return
    const id = window.setTimeout(() => {
      if (savingRef.current || hasConflictRef.current || loadingRef.current) return
      if (textRef.current === savedTextRef.current) return
      save(false)
    }, AUTO_SAVE_MS)
    return () => window.clearTimeout(id)
  }, [text, isDirty, save, autoSave])

  // Ctrl+S / Cmd+S explicit save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (isDirty) save(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDirty, save])

  useEffect(() => {
    if (status !== SAVED_STATUS) return

    const clearTimeout = window.setTimeout(() => {
      setStatus(current => current === SAVED_STATUS ? '' : current)
    }, SAVED_STATUS_VISIBLE_MS + SAVED_STATUS_EXIT_MS)

    return () => {
      window.clearTimeout(clearTimeout)
    }
  }, [status])


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
        <div className="editor-date-group">
          <button className="btn-menu" onClick={onMenuClick} title="Open menu">☰</button>
          <button className="btn-day-nav" onClick={onPrevDay} aria-label="Previous day">‹</button>
          <h2>
            <span className="entry-date-text">{date}</span>
            <button
              className="entry-date-button"
              onClick={onMenuClick}
              aria-label={`Open calendar for ${date}`}
            >
              {date}
            </button>
          </h2>
          <button className="btn-day-nav" onClick={onNextDay} aria-label="Next day">›</button>
        </div>
        <div className="editor-actions">
          <label className="auto-save-toggle" title={autoSave ? 'Auto-save is on' : 'Auto-save is off'}>
            <input type="checkbox" checked={autoSave} onChange={onAutoSaveToggle} />
            <span>Auto</span>
          </label>
          <button
            className={`btn-save${saving ? ' btn-saving' : status === SAVED_STATUS ? ' btn-saved' : ''}`}
            onClick={() => save(true)}
            disabled={saving || !isDirty}
            aria-busy={saving}
          >
            {saving && <span className="btn-saving-spinner" aria-hidden="true" />}
            <span>{saving ? 'Saving…' : status === SAVED_STATUS ? '✓ Saved' : 'Save'}</span>
          </button>
          {savedText && <button className="btn-delete" onClick={del}>Delete</button>}
        </div>
      </div>
      {showDraftBanner && (
        <div className="restored-banner">
          <span>You have an unsaved draft for this entry.</span>
          <div className="restored-banner-actions">
            <button onClick={restoreDraft}>Restore</button>
            <button onClick={discardDraft}>Discard</button>
          </div>
        </div>
      )}
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
          onChange={e => {
            setText(e.target.value)
            if (status && status !== SAVED_STATUS) setStatus('')
          }}
          placeholder="Write your thoughts…"
          autoFocus
        />
      )}
    </div>
    </>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import type { PointerEvent } from 'react'
import { EntryConflictError } from '../hooks/useDiary'
import type { LoadedDiaryEntry } from '../types'
import { todayYmd, weekdayLabel, diaryDateLabel } from '../utils/date'
import { HistoryModal } from './HistoryModal'

interface Props {
  date: string
  getContent: (date: string) => Promise<LoadedDiaryEntry | null>
  onSave: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  onDelete: (date: string) => Promise<void>
  onMenuClick: () => void
  onDirtyChange: (isDirty: boolean) => void
  autoSave: boolean
  onPrevDay: () => void
  onNextDay: () => void
  pendingNavDate: string | null
  onPendingNavigate: () => void
  onCancelNavigation: () => void
  reauthSaveResult: LoadedDiaryEntry | null
  token: string | null
  onExpired: () => void
  onLoadComplete?: (date: string, entry: LoadedDiaryEntry | null) => void
}

function SaveIcon() {
  return (
    <svg className="btn-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="btn-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  )
}


const SAVED_STATUS = 'Saved.'
const SAVED_STATUS_VISIBLE_MS = 1600
const SAVED_STATUS_EXIT_MS = 220
const AUTO_SAVE_MS = 3000
const KEYBOARD_INSET_VAR = '--mobile-keyboard-inset-bottom'
const MOBILE_MEDIA_QUERY = '(max-width: 640px)'
const PULL_REFRESH_THRESHOLD = 72
const PULL_REFRESH_MAX = 96

function RefreshIcon() {
  return (
    <svg className="btn-icon" aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 21v-5h5" />
      <path d="M3 12A9 9 0 0 1 18.5 5.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

function SpinnerIcon() {
  return <span className="btn-saving-spinner" aria-hidden="true" />
}

function isMobileLayout(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

export function EntryEditor({ date, getContent, onSave, onDelete, onMenuClick, onDirtyChange, autoSave, onPrevDay, onNextDay, pendingNavDate, onPendingNavigate, onCancelNavigation, reauthSaveResult, token, onExpired, onLoadComplete }: Props) {
  const [text, setText] = useState('')
  const [savedText, setSavedText] = useState('')
  const [baseVersion, setBaseVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [explicitSaving, setExplicitSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [lastModified, setLastModified] = useState<string | null>(null)
  const moreMenuRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileIdRef = useRef<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [conflictRemote, setConflictRemote] = useState<LoadedDiaryEntry | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const weekday = weekdayLabel(date)
  const isToday = date === todayYmd()

  // Use a ref to track the latest onSave without restarting debounce timers
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])
  const getContentRef = useRef(getContent)
  useEffect(() => { getContentRef.current = getContent }, [getContent])
  const onLoadCompleteRef = useRef(onLoadComplete)
  useEffect(() => { onLoadCompleteRef.current = onLoadComplete }, [onLoadComplete])

const textRef = useRef(text)
const savedTextRef = useRef(savedText)
const baseVersionRef = useRef(baseVersion)
const savingRef = useRef(saving)
const explicitSavingRef = useRef(explicitSaving)
const hasConflictRef = useRef(hasConflict)
const loadingRef = useRef(loading)
const refreshingRef = useRef(refreshing)
const pullDistanceRef = useRef(pullDistance)

useEffect(() => {
  textRef.current = text
  savedTextRef.current = savedText
  baseVersionRef.current = baseVersion
  savingRef.current = saving
  explicitSavingRef.current = explicitSaving
  hasConflictRef.current = hasConflict
  loadingRef.current = loading
  refreshingRef.current = refreshing
  pullDistanceRef.current = pullDistance
}, [text, savedText, baseVersion, saving, explicitSaving, hasConflict, loading, refreshing, pullDistance])

  const applyLoadedEntry = useCallback((entry: LoadedDiaryEntry | null) => {
    const driveText = entry?.entry.content ?? ''
    setText(driveText)
    setSavedText(driveText)
    setBaseVersion(entry?.meta.version ?? null)
    setLastModified(entry?.entry.updated_at ?? null)
    fileIdRef.current = entry?.meta.id ?? null
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setText('')
    setSavedText('')
    setBaseVersion(null)
    setLastModified(null)
    setStatus('')
    setHasConflict(false)
    setConflictRemote(null)
    setShowRefreshConfirm(false)
    fileIdRef.current = null
    getContentRef.current(date).then(entry => {
      if (cancelled) return
      applyLoadedEntry(entry)
      onLoadCompleteRef.current?.(date, entry)
    }).catch(() => {
      if (!cancelled) setStatus('Failed to load entry.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [date, applyLoadedEntry])

  const isDirty = text !== savedText

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (!reauthSaveResult || reauthSaveResult.entry.date !== date) return

    const content = reauthSaveResult.entry.content
    const currentText = textRef.current
    const previousSavedText = savedTextRef.current

    setSavedText(content)
    setBaseVersion(reauthSaveResult.meta.version ?? null)
    setLastModified(reauthSaveResult.entry.updated_at ?? null)
    fileIdRef.current = reauthSaveResult.meta.id

    if (currentText === previousSavedText || currentText === content) {
      setText(content)
      setStatus(SAVED_STATUS)
    }
  }, [date, reauthSaveResult])

  const pendingNavDateRef = useRef(pendingNavDate)
  useEffect(() => { pendingNavDateRef.current = pendingNavDate }, [pendingNavDate])
  const onCancelNavigationRef = useRef(onCancelNavigation)
  useEffect(() => { onCancelNavigationRef.current = onCancelNavigation }, [onCancelNavigation])

  const save = useCallback(async (explicit = true): Promise<boolean> => {
    if (savingRef.current) return false
    setSaving(true)
    if (explicit) {
      setExplicitSaving(true)
      setStatus('')
      setHasConflict(false)
      setConflictRemote(null)
    }
    try {
      const currentText = textRef.current
      const saved = await onSaveRef.current(date, currentText, baseVersionRef.current)
      setSavedText(currentText)
      setBaseVersion(saved.meta.version ?? null)
      setLastModified(saved.entry.updated_at ?? null)
      fileIdRef.current = saved.meta.id
      setStatus(SAVED_STATUS)
      setShowRefreshConfirm(false)
      return true
    } catch (e) {
      if (!explicit) {
        // Auto-save silently swallows errors; conflicts surface on next manual save
        console.error('Auto-save failed:', e)
        return false
      }
      if (e instanceof EntryConflictError) {
        setHasConflict(true)
        setConflictRemote(e.remote)
        setStatus('This entry changed on another device.')
      } else {
        setStatus('Save failed.')
      }
      return false
    } finally {
      setSaving(false)
      if (explicit) setExplicitSaving(false)
    }
  }, [date])

  const handleExplicitSave = useCallback(async () => {
    const ok = await save(true)
    if (ok && pendingNavDateRef.current) {
      onCancelNavigationRef.current()
    }
  }, [save])

  const handleSaveAndNavigate = useCallback(async () => {
    const ok = await save(true)
    if (ok) {
      onPendingNavigate()
    } else {
      onCancelNavigation()
    }
  }, [save, onPendingNavigate, onCancelNavigation])

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
    setExplicitSaving(true)
    setStatus('')
    try {
      const currentText = textRef.current
      const saved = await onSaveRef.current(date, currentText, conflictRemote?.meta.version ?? baseVersionRef.current, true)
      setSavedText(currentText)
      setBaseVersion(saved.meta.version ?? null)
      setHasConflict(false)
      setConflictRemote(null)
      setStatus(SAVED_STATUS)
    } catch {
      setStatus('Save failed.')
    } finally {
      setSaving(false)
      setExplicitSaving(false)
    }
  }

  const loadFreshEntry = useCallback(async () => {
    setRefreshing(true)
    setShowRefreshConfirm(false)
    setStatus('')
    try {
      const entry = await getContentRef.current(date)
      applyLoadedEntry(entry)
      setHasConflict(false)
      setConflictRemote(null)
    } catch {
      setStatus('Failed to refresh entry.')
    } finally {
      setRefreshing(false)
    }
  }, [date, applyLoadedEntry])

  const refreshEntry = useCallback(async () => {
    if (loadingRef.current || savingRef.current || refreshingRef.current || hasConflictRef.current) return
    if (textRef.current !== savedTextRef.current) {
      setShowRefreshConfirm(true)
      setStatus('')
      return
    }

    await loadFreshEntry()
  }, [loadFreshEntry])

  const handleSaveAndRefresh = useCallback(async () => {
    const ok = await save(true)
    if (ok) {
      await loadFreshEntry()
    }
  }, [save, loadFreshEntry])

  const handleDiscardAndRefresh = useCallback(async () => {
    setText(savedTextRef.current)
    setShowRefreshConfirm(false)
    await loadFreshEntry()
  }, [loadFreshEntry])

  const del = async () => {
    setDeleteInput('')
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    setShowDeleteModal(false)
    await onDelete(date)
  }

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty) handleExplicitSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isDirty, handleExplicitSave])

  useEffect(() => {
    if (status !== SAVED_STATUS) return

    const clearTimeout = window.setTimeout(() => {
      setStatus(current => current === SAVED_STATUS ? '' : current)
    }, SAVED_STATUS_VISIBLE_MS + SAVED_STATUS_EXIT_MS)

    return () => {
      window.clearTimeout(clearTimeout)
    }
  }, [status])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return

    let frameId: number | null = null

    const updateKeyboardInset = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        const keyboardInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        document.documentElement.style.setProperty(KEYBOARD_INSET_VAR, `${Math.round(keyboardInset)}px`)
      })
    }

    updateKeyboardInset()
    viewport.addEventListener('resize', updateKeyboardInset)
    viewport.addEventListener('scroll', updateKeyboardInset)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      viewport.removeEventListener('resize', updateKeyboardInset)
      viewport.removeEventListener('scroll', updateKeyboardInset)
      document.documentElement.style.removeProperty(KEYBOARD_INSET_VAR)
    }
  }, [])

  useEffect(() => {
    if (!showMoreMenu) return
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMoreMenu])

  const pullStartYRef = useRef<number | null>(null)
  const pullActiveRef = useRef(false)

  const canStartPullRefresh = useCallback(() => {
    const textarea = textareaRef.current
    return Boolean(
      isMobileLayout() &&
      textarea &&
      textarea.scrollTop <= 1 &&
      !loadingRef.current &&
      !savingRef.current &&
      !refreshingRef.current &&
      !hasConflictRef.current &&
      !showDeleteModal &&
      !showHistoryModal,
    )
  }, [showDeleteModal, showHistoryModal])

  const handleTouchStart = useCallback((e: globalThis.TouchEvent) => {
    if (!canStartPullRefresh()) return
    pullStartYRef.current = e.touches[0]?.clientY ?? null
    pullActiveRef.current = pullStartYRef.current !== null
  }, [canStartPullRefresh])

  const handleTouchMove = useCallback((e: globalThis.TouchEvent) => {
    if (!pullActiveRef.current || pullStartYRef.current === null) return
    const textarea = textareaRef.current
    if (!textarea || textarea.scrollTop > 1) {
      pullActiveRef.current = false
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    const distance = (e.touches[0]?.clientY ?? pullStartYRef.current) - pullStartYRef.current
    if (distance <= 0) {
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    if (e.cancelable) e.preventDefault()
    const nextDistance = Math.min(PULL_REFRESH_MAX, distance * 0.55)
    pullDistanceRef.current = nextDistance
    setPullDistance(nextDistance)
  }, [])

  const finishPullRefresh = useCallback(() => {
    if (!pullActiveRef.current) return
    const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_THRESHOLD
    pullStartYRef.current = null
    pullActiveRef.current = false
    pullDistanceRef.current = 0
    setPullDistance(0)
    if (shouldRefresh) void refreshEntry()
  }, [refreshEntry])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    textarea.addEventListener('touchstart', handleTouchStart, { passive: true })
    textarea.addEventListener('touchmove', handleTouchMove, { passive: false })
    textarea.addEventListener('touchend', finishPullRefresh)
    textarea.addEventListener('touchcancel', finishPullRefresh)

    return () => {
      textarea.removeEventListener('touchstart', handleTouchStart)
      textarea.removeEventListener('touchmove', handleTouchMove)
      textarea.removeEventListener('touchend', finishPullRefresh)
      textarea.removeEventListener('touchcancel', finishPullRefresh)
    }
  }, [loading, handleTouchStart, handleTouchMove, finishPullRefresh])

  const handlePointerDown = useCallback((e: PointerEvent<HTMLTextAreaElement>) => {
    if (e.pointerType !== 'touch' || !canStartPullRefresh()) return
    pullStartYRef.current = e.clientY
    pullActiveRef.current = true
  }, [canStartPullRefresh])

  const handlePointerMove = useCallback((e: PointerEvent<HTMLTextAreaElement>) => {
    if (e.pointerType !== 'touch' || !pullActiveRef.current || pullStartYRef.current === null) return
    const textarea = textareaRef.current
    if (!textarea || textarea.scrollTop > 1) {
      pullActiveRef.current = false
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    const distance = e.clientY - pullStartYRef.current
    if (distance <= 0) {
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }

    if (e.cancelable) e.preventDefault()
    const nextDistance = Math.min(PULL_REFRESH_MAX, distance * 0.55)
    pullDistanceRef.current = nextDistance
    setPullDistance(nextDistance)
  }, [])

  return (
    <>
    {showHistoryModal && fileIdRef.current && token && (
      <HistoryModal
        date={date}
        fileId={fileIdRef.current}
        token={token}
        baseVersion={baseVersion}
        text={text}
        savedText={savedText}
        isDirty={isDirty}
        autoSave={autoSave}
        onSave={onSave}
        onRestored={(result) => {
          const content = result.entry.content
          setText(content)
          setSavedText(content)
          setBaseVersion(result.meta.version ?? null)
          setLastModified(result.entry.updated_at ?? null)
          fileIdRef.current = result.meta.id
          setShowHistoryModal(false)
        }}
        onClose={() => setShowHistoryModal(false)}
        onExpired={onExpired}
      />
    )}
    {showDeleteModal && (
      <div className="delete-modal-overlay" onClick={() => setShowDeleteModal(false)}>
        <div className="delete-modal" onClick={e => e.stopPropagation()}>
          <h3>Delete entry?</h3>
          <p>The entry for {diaryDateLabel(date)} will be permanently deleted and cannot be undone.</p>
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
    {explicitSaving && (
      <div className="saving-overlay">
        <div className="saving-modal">
          <span className="saving-spinner" aria-hidden="true" />
          <span className="saving-text">Saving…</span>
        </div>
      </div>
    )}
    <div className="editor">
      <div
        className={`pull-refresh-indicator${pullDistance >= PULL_REFRESH_THRESHOLD ? ' ready' : ''}${refreshing ? ' refreshing' : ''}`}
        style={{ transform: `translate(-50%, ${refreshing ? 0 : Math.round(pullDistance - PULL_REFRESH_MAX)}px)` }}
        aria-hidden="true"
      >
        <span className="pull-refresh-spinner" />
      </div>
      <div className="editor-header">
        <div className="editor-date-group">
          <button className="btn-menu" onClick={onMenuClick} title="Open menu">☰</button>
          <button className="btn-day-nav" onClick={onPrevDay} aria-label="Previous day">‹</button>
          <h2>
            <span
              className="entry-date-text"
              data-today={isToday || undefined}
              data-dirty={isDirty || undefined}
              aria-label={isToday ? `${diaryDateLabel(date)}${weekday ? ` ${weekday}` : ''}, Today` : undefined}
            >
              <span className="entry-date-label-full">{diaryDateLabel(date)}</span>
              <span className="entry-date-label-short">{diaryDateLabel(date, true, 'short')}</span>
              {weekday && <span className="entry-date-weekday">{weekday}</span>}
            </span>
          </h2>
          <button className="btn-day-nav" onClick={onNextDay} aria-label="Next day">›</button>
        </div>
        <div className="editor-actions">
          <button
            className="btn-refresh-entry"
            onClick={refreshEntry}
            disabled={loading || saving || refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing entry' : 'Refresh entry'}
            title="Refresh entry"
          >
            {refreshing ? <SpinnerIcon /> : <RefreshIcon />}
          </button>
          <button
            className={`btn-save${saving ? ' btn-saving' : status === SAVED_STATUS ? ' btn-saved' : ''}`}
            onClick={handleExplicitSave}
            disabled={saving || !isDirty}
            aria-busy={saving}
            aria-label={saving ? 'Saving' : status === SAVED_STATUS ? 'Saved' : 'Save'}
          >
            {saving
              ? <span className="btn-saving-spinner" aria-hidden="true" />
              : status === SAVED_STATUS ? <CheckIcon /> : <SaveIcon />}
            <span className="btn-text">{saving ? 'Saving…' : status === SAVED_STATUS ? 'Saved' : 'Save'}</span>
          </button>
          <div className="more-menu-container" ref={moreMenuRef}>
            <button className="btn-more" onClick={() => setShowMoreMenu(v => !v)} aria-label="More options">···</button>
            {showMoreMenu && (
              <div className="more-menu">
                {token && fileIdRef.current && (
                  <div className="more-menu-item" onClick={() => { setShowMoreMenu(false); setShowHistoryModal(true) }}>
                    History
                  </div>
                )}
                {token && fileIdRef.current && (
                  <div className="more-menu-item" onClick={() => {
                    setShowMoreMenu(false)
                    window.open(`https://drive.google.com/file/d/${fileIdRef.current}/view`, '_blank')
                  }}>
                    Open in Drive
                  </div>
                )}
                <div
                  className={`more-menu-item more-menu-delete${!fileIdRef.current ? ' more-menu-item-disabled' : ''}`}
                  onClick={fileIdRef.current ? del : undefined}
                >
                  Delete
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="editor-meta">
        {isToday && !lastModified && (
          <>Today's entry</>
        )}
        {isToday && lastModified && (
          <>Today's entry - Last modified: <relative-time datetime={lastModified} /></>
        )}
        {!isToday && lastModified && (
          <>Last modified: <relative-time datetime={lastModified} /></>
        )}
      </div>
      {status && status !== SAVED_STATUS && (
        <div className="editor-status-line" role="status">{status}</div>
      )}
      {pendingNavDate && (
        <div className="unsaved-nav-banner">
          <span>Unsaved changes — save before leaving?</span>
          <div className="unsaved-nav-actions">
            <button onClick={handleSaveAndNavigate} disabled={saving}>Save</button>
            <button onClick={onPendingNavigate}>Discard</button>
            <button onClick={onCancelNavigation}>Cancel</button>
          </div>
        </div>
      )}
      {showRefreshConfirm && !pendingNavDate && (
        <div className="unsaved-nav-banner">
          <span>Unsaved changes — save before refreshing?</span>
          <div className="unsaved-nav-actions">
            <button onClick={handleSaveAndRefresh} disabled={saving || refreshing}>Save</button>
            <button onClick={handleDiscardAndRefresh} disabled={refreshing}>Discard</button>
            <button onClick={() => setShowRefreshConfirm(false)}>Cancel</button>
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
          ref={textareaRef}
          className="editor-textarea"
          value={text}
          onChange={e => {
            setText(e.target.value)
            if (status && status !== SAVED_STATUS) setStatus('')
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPullRefresh}
          onPointerCancel={finishPullRefresh}
          placeholder="Write your thoughts…"
          autoFocus
        />
      )}
    </div>
    </>
  )
}

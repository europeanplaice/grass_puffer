import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { PointerEvent } from 'react'
import { EntryConflictError } from '../hooks/useDiary'
import { TokenExpiredError } from '../api/driveEntries'
import type { LoadedDiaryEntry } from '../types'
import { todayYmd, yesterdayYmd, weekdayLabel, diaryDateLabel } from '../utils/date'
import { HistoryModal } from './HistoryModal'
import { shareEntry } from '../utils/share'
import { useI18n } from '../i18n'

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


const entryVariants = {
  enter: (dir: number) => ({ x: dir * 20, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -20, opacity: 0 }),
}

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
  const { t, locale } = useI18n()
  const savedStatus = t.entry.savedStatus
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
  const tokenExpiredForDateRef = useRef<string | null>(null)
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const weekday = weekdayLabel(date, locale)
  const isToday = date === todayYmd()
  const isYesterday = date === yesterdayYmd()

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
    }).catch((e) => {
      if (!cancelled) {
        if (e instanceof TokenExpiredError) {
          // TokenExpiredError is handled globally, so just skip showing "failed to load"
          tokenExpiredForDateRef.current = date
          return
        }
        setStatus(t.entry.failedToLoad)
      }
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [date, applyLoadedEntry])

  const directionRef = useRef(0)
  const prevDateRef = useRef(date)
  if (date !== prevDateRef.current) {
    directionRef.current = date > prevDateRef.current ? 1 : -1
    prevDateRef.current = date
  }

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
      setStatus(savedStatus)
    }
  }, [date, reauthSaveResult, savedStatus])

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
      setStatus(savedStatus)
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
        setStatus(t.entry.changedElsewhere)
      } else {
        setStatus(t.entry.saveFailed)
      }
      return false
    } finally {
      setSaving(false)
      if (explicit) setExplicitSaving(false)
    }
  }, [date, savedStatus, t])

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
    setStatus(conflictRemote ? t.entry.loadedLatest : t.entry.remoteDeleted)
  }

  const keepLocal = () => {
    setHasConflict(false)
    setConflictRemote(null)
    setStatus(t.entry.localKept)
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
      setStatus(savedStatus)
    } catch {
      setStatus(t.entry.saveFailed)
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
      setStatus(t.entry.failedToRefresh)
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

  useEffect(() => {
    if (token && tokenExpiredForDateRef.current === date) {
      tokenExpiredForDateRef.current = null
      refreshEntry()
    }
  }, [token, date, refreshEntry])

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
    if (status !== savedStatus) return

    const clearTimeout = window.setTimeout(() => {
      setStatus(current => current === savedStatus ? '' : current)
    }, SAVED_STATUS_VISIBLE_MS + SAVED_STATUS_EXIT_MS)

    return () => {
      window.clearTimeout(clearTimeout)
    }
  }, [status, savedStatus])

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

  const [shareMsgVisible, setShareMsgVisible] = useState(false)

  async function handleShareEntry() {
    setShowMoreMenu(false)
    const label = diaryDateLabel(date, true, 'long', locale)
    try {
      const result = await shareEntry(date, text, label)
      if (result === 'copied') {
        setShareMsgVisible(true)
        setTimeout(() => setShareMsgVisible(false), 2000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') console.error(e)
    }
  }

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
    <AnimatePresence>
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
    </AnimatePresence>
    <AnimatePresence>
      {showDeleteModal && (
        <motion.div className="delete-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={() => setShowDeleteModal(false)}
        >
          <motion.div className="delete-modal"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={e => e.stopPropagation()}
          >
            <h3>{t.entry.deleteTitle}</h3>
            <p>{t.entry.deleteDescription(diaryDateLabel(date, true, 'long', locale))}</p>
            <p className="delete-modal-hint">{t.entry.deleteHint}</p>
            <input
              className="delete-modal-input"
              value={deleteInput}
              onChange={e => setDeleteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && deleteInput === t.entry.confirmKeyword) confirmDelete() }}
              autoFocus
              placeholder={t.entry.confirmKeyword}
            />
            <div className="delete-modal-actions">
              <button onClick={() => setShowDeleteModal(false)}>{t.common.cancel}</button>
              <button
                className="btn-delete"
                onClick={confirmDelete}
                disabled={deleteInput !== t.entry.confirmKeyword}
              >{t.common.delete}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <AnimatePresence>
      {explicitSaving && (
        <motion.div className="saving-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="saving-modal">
            <span className="saving-spinner" aria-hidden="true" />
            <span className="saving-text">{t.entry.savingOverlay}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
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
          <button className="btn-menu" onClick={onMenuClick} title={t.entry.openMenu}>☰</button>
          <motion.button className="btn-day-nav" onClick={onPrevDay} aria-label={t.entry.previousDay}
            whileTap={{ scale: 0.82 }}
            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
          >‹</motion.button>
          <h2>
            <span
              className="entry-date-text"
              data-today={isToday || undefined}
              data-dirty={isDirty || undefined}
              aria-label={isToday ? `${diaryDateLabel(date, true, 'long', locale)}${weekday ? ` ${weekday}` : ''}, ${t.common.today}` : undefined}
            >
              <span className="entry-date-label-full">{diaryDateLabel(date, true, 'long', locale)}</span>
              <span className="entry-date-label-short">{diaryDateLabel(date, true, 'short', locale)}</span>
              {weekday && <span className="entry-date-weekday">{weekday}</span>}
            </span>
          </h2>
          <motion.button className="btn-day-nav" onClick={onNextDay} aria-label={t.entry.nextDay}
            whileTap={{ scale: 0.82 }}
            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
          >›</motion.button>
        </div>
        <div className="editor-actions">
          <motion.button
            className="btn-refresh-entry"
            onClick={refreshEntry}
            disabled={loading || saving || refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? t.entry.refreshingEntry : t.entry.refreshEntry}
            title={t.entry.refreshEntry}
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
          >
            {refreshing ? <SpinnerIcon /> : <RefreshIcon />}
          </motion.button>
          <motion.button
            className={`btn-save${saving ? ' btn-saving' : status === savedStatus ? ' btn-saved' : ''}`}
            onClick={handleExplicitSave}
            disabled={saving || !isDirty}
            aria-busy={saving}
            aria-label={saving ? t.entry.saving : status === savedStatus ? t.common.saved : t.entry.save}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 600, damping: 25 }}
          >
            {saving
              ? <span className="btn-saving-spinner" aria-hidden="true" />
              : status === savedStatus ? <CheckIcon /> : <SaveIcon />}
            <span className="btn-text">{saving ? t.common.savingEllipsis : status === savedStatus ? t.common.saved : t.entry.save}</span>
          </motion.button>
          <div className="more-menu-container" ref={moreMenuRef}>
            <motion.button className="btn-more" onClick={() => setShowMoreMenu(v => !v)} aria-label={t.entry.moreOptions}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >···</motion.button>
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div className="more-menu"
                  initial={{ opacity: 0, scale: 0.91, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.91, y: -6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {token && fileIdRef.current && (
                    <div className="more-menu-item" onClick={() => { setShowMoreMenu(false); setShowHistoryModal(true) }}>
                      <svg className="btn-icon" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {t.entry.history}
                    </div>
                  )}
                  {token && fileIdRef.current && (
                    <div className="more-menu-item" onClick={() => {
                      setShowMoreMenu(false)
                      window.open(`https://drive.google.com/file/d/${fileIdRef.current}/view`, '_blank')
                    }}>
                      <svg className="btn-icon" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      {t.entry.openInDrive}
                    </div>
                  )}
                  <div className="more-menu-item" onClick={handleShareEntry}>
                    <svg className="btn-icon" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    {t.entry.shareEntry}
                  </div>
                  <div
                    className={`more-menu-item more-menu-delete${!fileIdRef.current ? ' more-menu-item-disabled' : ''}`}
                    onClick={fileIdRef.current ? del : undefined}
                  >
                    <svg className="btn-icon" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    {t.common.delete}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="editor-meta">
        {isToday && !lastModified && (
          <>{t.entry.todaysEntry}</>
        )}
        {isToday && lastModified && (
          <>{t.entry.entryLastModified(t.entry.todaysEntry)} <relative-time datetime={lastModified} /></>
        )}
        {isYesterday && !lastModified && (
          <>{t.entry.yesterdaysEntry}</>
        )}
        {isYesterday && lastModified && (
          <>{t.entry.entryLastModified(t.entry.yesterdaysEntry)} <relative-time datetime={lastModified} /></>
        )}
        {!isToday && !isYesterday && lastModified && (
          <>{t.entry.lastModified} <relative-time datetime={lastModified} /></>
        )}
      </div>
      {shareMsgVisible && (
        <div className="editor-share-toast" role="status">{t.entry.copiedToClipboard}</div>
      )}
      {status && status !== savedStatus && (
        <div className="editor-status-line" role="status">{status}</div>
      )}
      {pendingNavDate && (
        <div className="unsaved-nav-banner">
          <span>{t.entry.unsavedLeave}</span>
          <div className="unsaved-nav-actions">
            <button onClick={handleSaveAndNavigate} disabled={saving}>{t.common.save}</button>
            <button onClick={onPendingNavigate}>{t.common.discard}</button>
            <button onClick={onCancelNavigation}>{t.common.cancel}</button>
          </div>
        </div>
      )}
      {showRefreshConfirm && !pendingNavDate && (
        <div className="unsaved-nav-banner">
          <span>{t.entry.unsavedRefresh}</span>
          <div className="unsaved-nav-actions">
            <button onClick={handleSaveAndRefresh} disabled={saving || refreshing}>{t.common.save}</button>
            <button onClick={handleDiscardAndRefresh} disabled={refreshing}>{t.common.discard}</button>
            <button onClick={() => setShowRefreshConfirm(false)}>{t.common.cancel}</button>
          </div>
        </div>
      )}
      {hasConflict && (
        <div className="conflict-panel">
          <div>
            <strong>{t.entry.conflictTitle}</strong>
            <p>{conflictRemote ? t.entry.conflictRemote : t.entry.conflictDeleted}</p>
          </div>
          <div className="conflict-actions">
            <button onClick={loadRemote}>{conflictRemote ? t.entry.loadLatest : t.entry.clearLocal}</button>
            <button onClick={keepLocal}>{t.entry.keepLocal}</button>
            <button className="btn-delete" onClick={overwriteRemote} disabled={saving}>{t.entry.overwrite}</button>
          </div>
        </div>
      )}
      <AnimatePresence initial={false} custom={directionRef.current}>
        <motion.div
          key={date}
          custom={directionRef.current}
          variants={entryVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {loading ? (
            <div className="entry-skeleton" aria-label={t.entry.loadingEntry} aria-live="polite">
              <div className="entry-skeleton-row short" />
              <div className="entry-skeleton-row" />
              <div className="entry-skeleton-row medium" />
              <div className="entry-skeleton-row" />
              <div className="entry-skeleton-row long" />
              <div className="entry-skeleton-row medium" />
            </div>
          ) : (
            <motion.textarea
              ref={textareaRef}
              className="editor-textarea"
              value={text}
              onChange={e => {
                setText(e.target.value)
                if (status && status !== savedStatus) setStatus('')
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPullRefresh}
              onPointerCancel={finishPullRefresh}
              placeholder={t.entry.placeholder}
              autoFocus
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
    </>
  )
}

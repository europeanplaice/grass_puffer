import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { useAuth } from './hooks/useAuth'
import { useDiary } from './hooks/useDiary'
import { useTheme } from './hooks/useTheme'
import { useFont } from './hooks/useFont'
import { LoginScreen } from './components/LoginScreen'
import { SessionExpiredModal } from './components/SessionExpiredModal'
import { CalendarView } from './components/CalendarView'
import { EntryEditor } from './components/EntryEditor'
import { SearchBar } from './components/SearchBar'
import { SettingsModal } from './components/SettingsModal'
import { AppIcon } from './components/AppIcon'
import { todayYmd, ymd, parseYmd, weekdayLabel, diaryDateLabel } from './utils/date'
import { TokenExpiredError } from './api/driveEntries'
import type { LoadedDiaryEntry } from './types'

type RecentPreview = {
  snippet: string
  hasContent: boolean
}

const DATE_HASH_RE = /^\d{4}-\d{2}-\d{2}$/
const MOBILE_MEDIA_QUERY = '(max-width: 640px)'

type AppHistoryState = {
  grassPuffer: true
  view: 'calendar' | 'entry'
  date: string
}

function dateFromHash(): string | null {
  const hash = window.location.hash.slice(1)
  return DATE_HASH_RE.test(hash) ? hash : null
}

function isMobileLayout(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function currentPathWithoutHash(): string {
  return `${window.location.pathname}${window.location.search}`
}

function entryPath(date: string): string {
  return `${currentPathWithoutHash()}#${date}`
}

function firstLinePreview(content: string): string {
  const firstLine = content.split(/\r?\n/).find(line => line.trim())?.trim() ?? ''
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine
}

function appHistoryState(view: AppHistoryState['view'], date: string): AppHistoryState {
  return { grassPuffer: true, view, date }
}

function isCalendarHistoryState(state: unknown): state is AppHistoryState {
  return Boolean(
    state &&
    typeof state === 'object' &&
    (state as Partial<AppHistoryState>).grassPuffer === true &&
    (state as Partial<AppHistoryState>).view === 'calendar',
  )
}

function dismissActiveTextCursor() {
  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) return

  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
    const wasReadOnly = activeElement.readOnly
    activeElement.readOnly = true
    try {
      activeElement.setSelectionRange(0, 0)
    } catch {
      // Some input types do not support text selection.
    }
    activeElement.blur()
    requestAnimationFrame(() => {
      activeElement.readOnly = wasReadOnly
    })
  } else {
    activeElement.blur()
  }

  window.getSelection()?.removeAllRanges()
}

function RestoringScreen({ selectedDate, onTitleClick }: { selectedDate: string; onTitleClick: () => void }) {
  return (
    <div className="app restoring-app">
      <aside className="sidebar restoring-sidebar open">
        <div className="sidebar-top">
          <h1 className="app-title" onClick={onTitleClick}><AppIcon className="app-title-icon" /> Diary</h1>
        </div>
        <div className="restoring-search" />
        <CalendarView dates={new Set()} selectedDate={selectedDate} onSelect={() => {}} />
        <div className="sidebar-status">Restoring your session…</div>
        <ul className="entry-list restoring-entry-list">
          <li />
          <li />
          <li />
        </ul>
      </aside>
      <main className="main">
        <div className="editor restoring-editor">
          <div className="editor-header">
            <h2>{diaryDateLabel(selectedDate)}</h2>
            <span className="editor-status">Signing in…</span>
          </div>
          <div className="restoring-lines">
            <span />
            <span />
            <span />
          </div>
        </div>
      </main>
    </div>
  )
}

function shiftDate(date: string, days: number): string {
  const parts = parseYmd(date)
  const d = parts ? new Date(parts.y, parts.m - 1, parts.d) : new Date()
  d.setDate(d.getDate() + days)
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export default function App() {
  const {
    accessToken,
    status,
    authReady,
    wasPreviouslySignedIn,
    loadFailed,
    tokenExpired,
    signIn,
    signOut,
    forgetSession,
    handleExpired,
    retryAfterExpired,
  } = useAuth()
  const { effectiveTheme, toggleTheme } = useTheme()
const { mode: fontMode, toggleFont } = useFont()
  const [selectedDate, setSelectedDate] = useState(todayYmd)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('grass_puffer_autosave') !== 'false')
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [retrySaveAfterReauth, setRetrySaveAfterReauth] = useState(false)
  const [reauthSaveResult, setReauthSaveResult] = useState<LoadedDiaryEntry | null>(null)
  const [recentPreviews, setRecentPreviews] = useState<Map<string, RecentPreview>>(new Map())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const selectedDateRef = useRef(selectedDate)
  const editorDirtyRef = useRef(editorDirty)
  const seededMobileHistoryRef = useRef(false)

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  useEffect(() => {
    editorDirtyRef.current = editorDirty
  }, [editorDirty])

  const onExpired = useCallback(() => {
    handleExpired()
  }, [handleExpired])

  const diary = useDiary(accessToken, onExpired)

  useEffect(() => {
    if (!accessToken) {
      seededMobileHistoryRef.current = false
      return
    }
    const nextDate = dateFromHash() ?? selectedDateRef.current
    setSelectedDate(nextDate)
    selectedDateRef.current = nextDate

    if (isMobileLayout() && !seededMobileHistoryRef.current) {
      history.replaceState(appHistoryState('calendar', nextDate), '', currentPathWithoutHash())
      history.pushState(appHistoryState('entry', nextDate), '', entryPath(nextDate))
      seededMobileHistoryRef.current = true
      setSidebarOpen(false)
    }
  }, [accessToken])

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const hashDate = dateFromHash()
      if (isMobileLayout() && (isCalendarHistoryState(event.state) || !hashDate)) {
        setSidebarOpen(true)
        return
      }

      if (hashDate) {
        setSelectedDate(hashDate)
        selectedDateRef.current = hashDate
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!editorDirtyRef.current) return

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useLayoutEffect(() => {
    if (!sidebarOpen || !isMobileLayout()) return

    dismissActiveTextCursor()
  }, [sidebarOpen])

  const closeSidebar = useCallback(() => {
    if (isMobileLayout() && !dateFromHash()) {
      const date = selectedDateRef.current
      history.pushState(appHistoryState('entry', date), '', entryPath(date))
    }
    setSidebarOpen(false)
  }, [])

  const doNavigateToDate = useCallback((d: string) => {
    if (isMobileLayout()) {
      history.replaceState(appHistoryState('calendar', d), '', currentPathWithoutHash())
      history.pushState(appHistoryState('entry', d), '', entryPath(d))
    } else {
      history.pushState(null, '', '#' + d)
    }
    setSelectedDate(d)
    selectedDateRef.current = d
    setSidebarOpen(false)
    setPendingDate(null)
  }, [])

  const selectDate = useCallback((d: string) => {
    if (d !== selectedDateRef.current && editorDirtyRef.current) {
      setPendingDate(d)
      return
    }
    doNavigateToDate(d)
  }, [doNavigateToDate])

  const handleTitleClick = useCallback(() => {
    selectDate(todayYmd())
  }, [selectDate])

  const handlePendingNavigate = useCallback(() => {
    if (pendingDate) doNavigateToDate(pendingDate)
  }, [pendingDate, doNavigateToDate])

  const handleCancelNavigation = useCallback(() => {
    setPendingDate(null)
  }, [])

  const handleAutoSaveToggle = useCallback(() => {
    setAutoSave(prev => {
      const next = !prev
      localStorage.setItem('grass_puffer_autosave', String(next))
      return next
    })
  }, [])

  const onPrevDay = useCallback(() => {
    selectDate(shiftDate(selectedDateRef.current, -1))
  }, [selectDate])

  const onNextDay = useCallback(() => {
    selectDate(shiftDate(selectedDateRef.current, 1))
  }, [selectDate])

  const handleSignOut = useCallback(() => {
    seededMobileHistoryRef.current = false
    history.replaceState(null, '', '#')
    setPendingDate(null)
    signOut()
  }, [signOut])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.repeat) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
          e.preventDefault()
          toggleTheme()
          return
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
          e.preventDefault()
          toggleFont()
          return
        }
      }
      if (!e.altKey || e.repeat) return
      if (document.activeElement instanceof HTMLInputElement) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        selectDate(shiftDate(selectedDateRef.current, -1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        selectDate(shiftDate(selectedDateRef.current, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectDate(todayYmd())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectDate, toggleTheme, toggleFont])

  const datesSet = useMemo(() => new Set(diary.dates), [diary.dates])
  const recentDates = diary.dates.slice(0, 5)
  const todayDate = todayYmd()

  useEffect(() => {
    let cancelled = false

    if (!accessToken || recentDates.length === 0) {
      setRecentPreviews(new Map())
      return
    }

    Promise.all(
      recentDates.map(async date => {
        const loaded = await diary.getContent(date)
        return [
          date,
          {
            snippet: firstLinePreview(loaded?.entry.content ?? ''),
            hasContent: Boolean(loaded?.entry.content.trim()),
          },
        ] as const
      }),
    ).then(previews => {
      if (cancelled) return
      setRecentPreviews(new Map(previews))
    }).catch(() => {
      if (!cancelled) setRecentPreviews(new Map())
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, diary.getContent, recentDates.join('|')])

  const handleReauth = useCallback(async () => {
    await signIn()
    setRetrySaveAfterReauth(true)
  }, [signIn])

  useEffect(() => {
    if (!accessToken || !retrySaveAfterReauth) return

    let cancelled = false
    diary.retryPendingSave()
      .then(result => {
        if (!cancelled && result) setReauthSaveResult(result)
      })
      .catch(e => {
        if (e instanceof TokenExpiredError) return
        if (!cancelled) console.error('Pending save retry failed:', e)
      })
      .finally(() => {
        if (!cancelled) setRetrySaveAfterReauth(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, retrySaveAfterReauth, diary.retryPendingSave])

  if (status === 'initializing') {
    return <RestoringScreen selectedDate={selectedDate} onTitleClick={handleTitleClick} />
  }

  if (!accessToken && !tokenExpired) {
    return (
      <LoginScreen
        onSignIn={signIn}
        onRetry={retryAfterExpired}
        onForgetSession={forgetSession}
        authReady={authReady}
        wasPreviouslySignedIn={wasPreviouslySignedIn}
        loadFailed={loadFailed}
        tokenExpired={tokenExpired}
      />
    )
  }

  return (
    <div className="app">
      {tokenExpired && <SessionExpiredModal onReauth={handleReauth} />}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <h1 className="app-title" onClick={handleTitleClick}><AppIcon className="app-title-icon" /> Diary</h1>
          <div className="sidebar-actions">
            <button className="btn-close-sidebar" onClick={closeSidebar} title="Close menu" aria-label="Close menu">×</button>
            <button className="btn-theme-toggle" onClick={toggleTheme} title={`Switch to ${effectiveTheme === 'dark' ? 'light' : 'dark'} theme`} aria-label="Toggle theme">
              {effectiveTheme === 'dark' ? (
                <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              ) : (
                <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              )}
            </button>
            <button className="btn-font-toggle" onClick={toggleFont} title={`Switch to ${fontMode === 'serif' ? 'sans-serif' : 'serif'} font`} aria-label="Toggle font">
              {fontMode === 'serif' ? (
                <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><text x="3" y="18" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="600">S</text></svg>
              ) : (
                <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><text x="3" y="18" fontFamily="Georgia, serif" fontSize="16" fontWeight="600">T</text></svg>
              )}
            </button>
            <button className="btn-signout" onClick={handleSignOut} title="Sign out">↩</button>
          </div>
        </div>
        <SearchBar onSearch={diary.search} onSelect={selectDate} entriesLoading={diary.loading} />
        <CalendarView dates={datesSet} selectedDate={selectedDate} onSelect={selectDate} />
        {diary.loading && <div className="sidebar-status">Loading entries…</div>}
        {diary.error && <div className="sidebar-status error">{diary.error}</div>}
        {recentDates.length > 0 && <h2 className="entry-list-heading">Recent</h2>}
        <ul className="entry-list">
          {recentDates.map(d => {
            const preview = recentPreviews.get(d)
            const isToday = d === todayDate
            const weekday = weekdayLabel(d)
            return (
            <li
              key={d}
              className={[d === selectedDate ? 'active' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => selectDate(d)}
            >
              <span
                className="entry-list-date"
                data-today={isToday || undefined}
                aria-label={isToday ? `${diaryDateLabel(d, false)}${weekday ? ` ${weekday}` : ''}, Today` : undefined}
              >
                <span>{diaryDateLabel(d, false)}</span>
                {weekday && <span className="entry-list-weekday">{weekday}</span>}
              </span>
              <span className="entry-list-preview">
                {preview?.hasContent ? preview.snippet : 'No text yet'}
              </span>
            </li>
          )})}
        </ul>
        <button className="btn-settings" onClick={() => setSettingsOpen(true)} title="Settings">
            <svg className="btn-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="btn-text">Settings</span>
          </button>
      </aside>
      {settingsOpen && (
        <SettingsModal
          autoSave={autoSave}
          onAutoSaveToggle={handleAutoSaveToggle}
          dates={diary.dates}
          onExport={diary.exportAll}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      <main className="main">
        <EntryEditor
          date={selectedDate}
          getContent={diary.getContent}
          onSave={diary.save}
          onDelete={diary.remove}
          onMenuClick={() => {
            if (isMobileLayout()) setSidebarOpen(true)
          }}
          onDirtyChange={setEditorDirty}
          autoSave={autoSave}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
          pendingNavDate={pendingDate}
          onPendingNavigate={handlePendingNavigate}
          onCancelNavigation={handleCancelNavigation}
          reauthSaveResult={reauthSaveResult}
          token={accessToken}
          onExpired={onExpired}
        />
      </main>
    </div>
  )
}

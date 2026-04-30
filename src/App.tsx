import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useDiary } from './hooks/useDiary'
import { LoginScreen } from './components/LoginScreen'
import { CalendarView } from './components/CalendarView'
import { EntryEditor } from './components/EntryEditor'
import { SearchBar } from './components/SearchBar'
import { AppIcon } from './components/AppIcon'

type RecentPreview = {
  snippet: string
  hasContent: boolean
}

function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function parseYMD(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function weekdayLabel(date: string): string {
  const parsed = parseYMD(date)
  if (!parsed) return ''

  return parsed.toLocaleDateString(undefined, { weekday: 'short' })
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

function RestoringScreen({ selectedDate }: { selectedDate: string }) {
  return (
    <div className="app restoring-app">
      <aside className="sidebar restoring-sidebar open">
        <div className="sidebar-top">
          <h1 className="app-title"><AppIcon className="app-title-icon" /> Diary</h1>
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
            <h2>{selectedDate}</h2>
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
  const d = parseYMD(date) ?? new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const { accessToken, status, loadFailed, signIn, signOut, handleExpired } = useAuth()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayYMD)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [autoSave, setAutoSave] = useState(() => localStorage.getItem('grass_puffer_autosave') !== 'false')
  const [recentPreviews, setRecentPreviews] = useState<Map<string, RecentPreview>>(new Map())
  const selectedDateRef = useRef(selectedDate)
  const editorDirtyRef = useRef(editorDirty)
  const seededMobileHistoryRef = useRef(false)

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  useEffect(() => {
    editorDirtyRef.current = editorDirty
  }, [editorDirty])

  useEffect(() => {
    const handler = () => setUpdateAvailable(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  const onExpired = useCallback(() => {
    handleExpired()
    setSessionExpired(true)
  }, [handleExpired])

  const diary = useDiary(accessToken, onExpired)

  useEffect(() => {
    if (!accessToken) {
      seededMobileHistoryRef.current = false
      return
    }

    setSessionExpired(false)
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

  const selectDate = useCallback((d: string) => {
    if (d !== selectedDateRef.current && editorDirtyRef.current) {
      const shouldLeave = window.confirm('You have unsaved changes. Leave this entry without saving?')
      if (!shouldLeave) return
    }

    if (isMobileLayout()) {
      history.replaceState(appHistoryState('calendar', d), '', currentPathWithoutHash())
      history.pushState(appHistoryState('entry', d), '', entryPath(d))
    } else {
      history.pushState(null, '', '#' + d)
    }
    setSelectedDate(d)
    selectedDateRef.current = d
    setSidebarOpen(false)
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
    signOut()
  }, [signOut])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.repeat) return
      // Don't fire when focused in a text input (e.g. delete-modal confirmation field)
      if (document.activeElement instanceof HTMLInputElement) return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        selectDate(shiftDate(selectedDateRef.current, -1))
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        selectDate(shiftDate(selectedDateRef.current, 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectDate(todayYMD())
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectDate])

  const datesSet = new Set(diary.dates)
  const recentDates = diary.dates.slice(0, 5)

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

  if (status === 'initializing') {
    return <RestoringScreen selectedDate={selectedDate} />
  }

  if (!accessToken) {
    return <LoginScreen onSignIn={signIn} sessionExpired={sessionExpired} loadFailed={loadFailed} />
  }

  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <h1 className="app-title"><AppIcon className="app-title-icon" /> Diary</h1>
          <div className="sidebar-actions">
            <button className="btn-close-sidebar" onClick={closeSidebar} title="Close menu" aria-label="Close menu">×</button>
            <button className="btn-signout" onClick={handleSignOut} title="Sign out">↩</button>
          </div>
        </div>
        <SearchBar onSearch={diary.search} onSelect={selectDate} entriesLoading={diary.loading} />
        <CalendarView dates={datesSet} selectedDate={selectedDate} onSelect={selectDate} />
        <label className="calendar-entry-toggle">
          <input type="checkbox" checked={autoSave} onChange={handleAutoSaveToggle} />
          <span>Auto-save</span>
        </label>
        {diary.loading && <div className="sidebar-status">Loading entries…</div>}
        {diary.error && <div className="sidebar-status error">{diary.error}</div>}
        {recentDates.length > 0 && <h2 className="entry-list-heading">Recent</h2>}
        <ul className="entry-list">
          {recentDates.map(d => {
            const preview = recentPreviews.get(d)
            return (
            <li
              key={d}
              className={d === selectedDate ? 'active' : ''}
              onClick={() => selectDate(d)}
            >
              <span className="entry-list-date">
                <span>{d}</span>
                {weekdayLabel(d) && <span className="entry-list-weekday">{weekdayLabel(d)}</span>}
              </span>
              <span className="entry-list-preview">
                {preview?.hasContent ? preview.snippet : 'No text yet'}
              </span>
            </li>
          )})}
        </ul>
      </aside>
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
        />
      </main>
      {updateAvailable && (
        <div className="update-banner">
          <span>A new version is available</span>
          <button onClick={() => window.location.reload()}>Update</button>
        </div>
      )}
    </div>
  )
}

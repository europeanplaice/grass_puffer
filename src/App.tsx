import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useAuth } from './hooks/useAuth'
import { useDiary } from './hooks/useDiary'
import { LoginScreen } from './components/LoginScreen'
import { CalendarView } from './components/CalendarView'
import { EntryEditor } from './components/EntryEditor'
import { SearchBar } from './components/SearchBar'
import { AppIcon } from './components/AppIcon'

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

export default function App() {
  const { accessToken, status, signIn, signOut, handleExpired } = useAuth()
  const [sessionExpired, setSessionExpired] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayYMD)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const selectedDateRef = useRef(selectedDate)
  const seededMobileHistoryRef = useRef(false)

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

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

  const handleSignOut = useCallback(() => {
    seededMobileHistoryRef.current = false
    history.replaceState(null, '', '#')
    signOut()
  }, [signOut])

  if (status === 'initializing') {
    return <RestoringScreen selectedDate={selectedDate} />
  }

  if (!accessToken) {
    return <LoginScreen onSignIn={signIn} sessionExpired={sessionExpired} />
  }

  const datesSet = new Set(diary.dates)

  return (
    <div className="app">
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <h1 className="app-title"><AppIcon className="app-title-icon" /> Diary</h1>
          <button className="btn-signout" onClick={handleSignOut} title="Sign out">↩</button>
        </div>
        <SearchBar onSearch={diary.search} onSelect={selectDate} entriesLoading={diary.loading} />
        <CalendarView dates={datesSet} selectedDate={selectedDate} onSelect={selectDate} />
        {diary.loading && <div className="sidebar-status">Loading entries…</div>}
        {diary.error && <div className="sidebar-status error">{diary.error}</div>}
        <ul className="entry-list">
          {diary.dates.map(d => (
            <li
              key={d}
              className={d === selectedDate ? 'active' : ''}
              onClick={() => selectDate(d)}
            >
              {d}
            </li>
          ))}
        </ul>
      </aside>
      <main className="main">
        <EntryEditor
          date={selectedDate}
          getContent={diary.getContent}
          onSave={diary.save}
          onDelete={diary.remove}
          onMenuClick={() => setSidebarOpen(true)}
        />
      </main>
    </div>
  )
}

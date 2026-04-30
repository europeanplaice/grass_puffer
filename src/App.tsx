import { useState, useCallback, useEffect } from 'react'
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

  const onExpired = useCallback(() => {
    handleExpired()
    setSessionExpired(true)
  }, [handleExpired])

  const diary = useDiary(accessToken, onExpired)

  useEffect(() => {
    if (accessToken) {
      setSessionExpired(false)
      const hash = window.location.hash.slice(1)
      if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
        setSelectedDate(hash)
      }
    }
  }, [accessToken])

  useEffect(() => {
    const handlePopState = () => {
      const hash = window.location.hash.slice(1)
      if (/^\d{4}-\d{2}-\d{2}$/.test(hash)) {
        setSelectedDate(hash)
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const selectDate = useCallback((d: string) => {
    history.pushState(null, '', '#' + d)
    setSelectedDate(d)
    setSidebarOpen(false)
  }, [])

  const handleSignOut = useCallback(() => {
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

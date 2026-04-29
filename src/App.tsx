import { useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { useDiary } from './hooks/useDiary'
import { LoginScreen } from './components/LoginScreen'
import { CalendarView } from './components/CalendarView'
import { EntryEditor } from './components/EntryEditor'
import { SearchBar } from './components/SearchBar'

function todayYMD(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const { accessToken, signIn, signOut } = useAuth()
  const diary = useDiary(accessToken)
  const [selectedDate, setSelectedDate] = useState(todayYMD)

  if (!accessToken) {
    return <LoginScreen onSignIn={signIn} />
  }

  const datesSet = new Set(diary.dates)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h1 className="app-title">📔 Diary</h1>
          <button className="btn-signout" onClick={signOut} title="Sign out">↩</button>
        </div>
        <SearchBar onSearch={diary.search} onSelect={setSelectedDate} />
        <CalendarView dates={datesSet} selectedDate={selectedDate} onSelect={setSelectedDate} />
        {diary.loading && <div className="sidebar-status">Loading entries…</div>}
        {diary.error && <div className="sidebar-status error">{diary.error}</div>}
        <ul className="entry-list">
          {diary.dates.map(d => (
            <li
              key={d}
              className={d === selectedDate ? 'active' : ''}
              onClick={() => setSelectedDate(d)}
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
        />
      </main>
    </div>
  )
}

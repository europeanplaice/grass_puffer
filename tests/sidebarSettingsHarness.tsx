import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/styles.css'

const root = createRoot(document.getElementById('root') as HTMLElement)

function App({ entryCount }: { entryCount: number }) {
  const [autoSave, setAutoSave] = useState(() =>
    localStorage.getItem('grass_puffer_autosave') !== 'false'
  )

  const handleToggle = () => {
    setAutoSave(prev => {
      const next = !prev
      localStorage.setItem('grass_puffer_autosave', String(next))
      return next
    })
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-top">
          <h1 className="app-title">Diary</h1>
        </div>
        <ul className="entry-list">
          {Array.from({ length: entryCount }, (_, i) => (
            <li key={i}>Entry {i + 1} — some preview text here</li>
          ))}
        </ul>
        <div className="sidebar-settings">
          <label className="sidebar-settings-toggle">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={handleToggle}
              aria-label="Auto-save"
            />
            <span>Auto-save</span>
          </label>
        </div>
      </aside>
    </div>
  )
}

window.settingsHarness = {
  render: ({ entryCount = 3 } = {}) => {
    root.render(<App entryCount={entryCount} />)
  },
  getStoredAutoSave: () => localStorage.getItem('grass_puffer_autosave'),
}

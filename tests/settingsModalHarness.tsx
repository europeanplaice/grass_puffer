import { useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsModal } from '../src/components/SettingsModal'
import '../src/styles.css'

type ExportCall = { onProgress: (done: number, total: number) => void }[]

const root = createRoot(document.getElementById('root') as HTMLElement)

const exportCalls: ExportCall = []
let exportReject = false

interface AppProps {
  autoSave: boolean
  modalOpen: boolean
}

function App({ autoSave: initialAutoSave, modalOpen: initialOpen }: AppProps) {
  const [autoSave, setAutoSave] = useState(initialAutoSave)
  const [open, setOpen] = useState(initialOpen)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [font, setFont] = useState<'serif' | 'sans'>('serif')

  const handleAutoSaveToggle = useCallback(() => {
    setAutoSave(prev => {
      const next = !prev
      localStorage.setItem('grass_puffer_autosave', String(next))
      return next
    })
  }, [])

  const handleExport = useCallback(async (onProgress: (done: number, total: number) => void) => {
    exportCalls.push({ onProgress })
    if (exportReject) throw new Error('Export failed')
    return []
  }, [])

  return (
    <>
      <button id="open-settings" onClick={() => setOpen(true)}>Open Settings</button>
      {open && (
        <SettingsModal
          autoSave={autoSave}
          onAutoSaveToggle={handleAutoSaveToggle}
          effectiveTheme={theme}
          onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
          fontMode={font}
          onFontToggle={() => setFont(f => f === 'serif' ? 'sans' : 'serif')}
          dates={['2026-05-01', '2026-05-02']}
          onExport={handleExport}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

window.settingsHarness = {
  render: ({ autoSave: initialAutoSave, modalOpen: initialOpen }: { autoSave?: boolean; modalOpen?: boolean } = {}) => {
    exportCalls.splice(0)
    exportReject = false
    root.render(
      <App
        autoSave={initialAutoSave ?? true}
        modalOpen={initialOpen ?? true}
        key={Date.now()}
      />
    )
  },
  getStoredAutoSave: () => localStorage.getItem('grass_puffer_autosave'),
  exportCalls: () => [...exportCalls],
  setExportReject: (v: boolean) => { exportReject = v },
}

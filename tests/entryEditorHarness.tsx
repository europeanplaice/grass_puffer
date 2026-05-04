import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EntryEditor } from '../src/components/EntryEditor'
import { EntryConflictError } from '../src/hooks/useDiary'
import type { LoadedDiaryEntry } from '../src/types'
import '../src/styles.css'

type SaveCall = { date: string; content: string; baseVersion: string | null; force?: boolean }
type DeleteCall = { date: string }
type NavCall = { date: string | null }

const root = createRoot(document.getElementById('root') as HTMLElement)

const saveCalls: SaveCall[] = []
const deleteCalls: DeleteCall[] = []
const pendingNavigateCalls: NavCall[] = []
const cancelNavigationCalls: NavCall[] = []
let menuClickCount = 0
const dirtyChanges: boolean[] = []

let currentSaveReject: 'conflict' | 'error' | undefined

function App({ date, initialContent, version, autoSave, getContentDelayMs, pendingNavDate: initialPendingNavDate }: {
  date: string
  initialContent: string
  version: string | null
  autoSave: boolean
  getContentDelayMs: number
  pendingNavDate: string | null
}) {
  const [pendingNavDate, setPendingNavDate] = useState<string | null>(initialPendingNavDate)

  return (
    <EntryEditor
      date={date}
      autoSave={autoSave}
      getContent={async () => {
        if (getContentDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, getContentDelayMs))
        }
        if (!initialContent && version === null) return null
        return {
          entry: { date, content: initialContent, updated_at: new Date().toISOString() },
          meta: { id: 'file-1', name: `diary-${date}.json`, version: version ?? undefined },
        }
      }}
      onSave={async (d, content, baseVer, force) => {
        saveCalls.push({ date: d, content, baseVersion: baseVer, force })
        if (currentSaveReject === 'conflict' && !force) {
          const remote: LoadedDiaryEntry = {
            entry: { date: d, content: 'remote content', updated_at: new Date().toISOString() },
            meta: { id: 'file-1', name: `diary-${d}.json`, version: '99' },
          }
          throw new EntryConflictError(remote)
        }
        if (currentSaveReject === 'error') {
          throw new Error('Network error')
        }
        return {
          entry: { date: d, content, updated_at: new Date().toISOString() },
          meta: { id: 'file-1', name: `diary-${d}.json`, version: '2' },
        }
      }}
      onDelete={async (d) => {
        deleteCalls.push({ date: d })
      }}
      onMenuClick={() => { menuClickCount++ }}
      onDirtyChange={(isDirty) => { dirtyChanges.push(isDirty) }}
      onPrevDay={() => {}}
      onNextDay={() => {}}
      pendingNavDate={pendingNavDate}
      onPendingNavigate={() => {
        pendingNavigateCalls.push({ date: pendingNavDate })
        setPendingNavDate(null)
      }}
      onCancelNavigation={() => {
        cancelNavigationCalls.push({ date: pendingNavDate })
        setPendingNavDate(null)
      }}
      reauthSaveResult={null}
      token={null}
      onExpired={() => {}}
    />
  )
}

window.editorHarness = {
  render: ({ date, initialContent, version, saveReject, autoSave, getContentDelayMs, pendingNavDate }) => {
    saveCalls.splice(0)
    deleteCalls.splice(0)
    pendingNavigateCalls.splice(0)
    cancelNavigationCalls.splice(0)
    menuClickCount = 0
    dirtyChanges.splice(0)
    currentSaveReject = saveReject
    root.render(
      <App
        date={date}
        initialContent={initialContent}
        version={version}
        autoSave={autoSave ?? true}
        getContentDelayMs={getContentDelayMs ?? 0}
        pendingNavDate={pendingNavDate ?? null}
      />
    )
  },
  saveCalls: () => [...saveCalls],
  deleteCalls: () => [...deleteCalls],
  pendingNavigateCalls: () => [...pendingNavigateCalls],
  cancelNavigationCalls: () => [...cancelNavigationCalls],
  menuClickCount: () => menuClickCount,
  dirtyChanges: () => [...dirtyChanges],
  clearCalls: () => {
    saveCalls.splice(0)
    deleteCalls.splice(0)
    pendingNavigateCalls.splice(0)
    cancelNavigationCalls.splice(0)
    menuClickCount = 0
    dirtyChanges.splice(0)
  },
  EntryConflictError,
}

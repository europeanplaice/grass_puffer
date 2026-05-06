import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EntryEditor } from '../src/components/EntryEditor'
import { EntryConflictError } from '../src/hooks/useDiary'
import type { LoadedDiaryEntry } from '../src/types'
import '../src/styles.css'

type SaveCall = { date: string; content: string; baseVersion: string | null; force?: boolean }
type DeleteCall = { date: string }
type NavCall = { date: string | null }
type WindowOpenCall = { url: string; target: string }
type GetContentCall = { date: string }
type LoadCompleteCall = { date: string; content: string | null; version: string | null }

const root = createRoot(document.getElementById('root') as HTMLElement)

let saveCalls: SaveCall[] = []
let deleteCalls: DeleteCall[] = []
let pendingNavigateCalls: NavCall[] = []
let cancelNavigationCalls: NavCall[] = []
let windowOpenCalls: WindowOpenCall[] = []
let getContentCalls: GetContentCall[] = []
let menuClickCount = 0
let dirtyChanges: boolean[] = []
let loadCompleteCalls: LoadCompleteCall[] = []

let currentSaveReject: 'conflict' | 'error' | undefined
let currentToken: string | null = null
let currentSaveDelayMs = 0
let currentRemoteContent = ''
let currentRemoteVersion: string | null = null

function delaySave(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Mock window.open
window.open = (url?: string | URL, target?: string) => {
  if (url) windowOpenCalls.push({ url: String(url), target: target ?? '' })
  return null
}

function App({ date, autoSave, getContentDelayMs, pendingNavDate: initialPendingNavDate, token }: {
  date: string
  autoSave: boolean
  getContentDelayMs: number
  pendingNavDate: string | null
  token: string | null
}) {
  const [pendingNavDate, setPendingNavDate] = useState<string | null>(initialPendingNavDate)

  return (
    <EntryEditor
      date={date}
      autoSave={autoSave}
      getContent={async (d) => {
        getContentCalls.push({ date: d })
        if (getContentDelayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, getContentDelayMs))
        }
        if (!currentRemoteContent && currentRemoteVersion === null) return null
        return {
          entry: { date, content: currentRemoteContent, updated_at: new Date().toISOString() },
          meta: { id: 'file-1', name: `diary-${date}.json`, version: currentRemoteVersion ?? undefined },
        }
      }}
      onSave={async (d, content, baseVer, force) => {
        if (currentSaveDelayMs > 0) {
          await delaySave(currentSaveDelayMs)
        }
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
        currentRemoteContent = content
        currentRemoteVersion = '2'
        return {
          entry: { date: d, content, updated_at: new Date().toISOString() },
          meta: { id: 'file-1', name: `diary-${d}.json`, version: currentRemoteVersion },
        }
      }}
      onDelete={async (d) => {
        deleteCalls.push({ date: d })
      }}
      onMenuClick={() => { menuClickCount++ }}
      onDirtyChange={(isDirty) => { dirtyChanges.push(isDirty) }}
      onLoadComplete={(loadedDate, loaded) => {
        loadCompleteCalls.push({
          date: loadedDate,
          content: loaded?.entry.content ?? null,
          version: loaded?.meta.version ?? null,
        })
      }}
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
      token={token}
      onExpired={() => {}}
    />
  )
}

window.editorHarness = {
  render: (opts: {
    date?: string
    initialContent?: string
    version?: string | null
    saveReject?: 'conflict' | 'error'
    autoSave?: boolean
    getContentDelayMs?: number
    pendingNavDate?: string | null
    token?: string | null
    saveDelayMs?: number
  }) => {
    saveCalls = []
    deleteCalls = []
    pendingNavigateCalls = []
    cancelNavigationCalls = []
    windowOpenCalls = []
    getContentCalls = []
    menuClickCount = 0
    dirtyChanges = []
    loadCompleteCalls = []
    currentSaveReject = opts.saveReject
    currentToken = opts.token ?? null
    currentSaveDelayMs = opts.saveDelayMs ?? 0
    currentRemoteContent = opts.initialContent ?? ''
    currentRemoteVersion = opts.version ?? null
    root.render(
      <App
        date={opts.date ?? '2026-05-01'}
        autoSave={opts.autoSave ?? true}
        getContentDelayMs={opts.getContentDelayMs ?? 0}
        pendingNavDate={opts.pendingNavDate ?? null}
        token={currentToken}
      />
    )
  },
  saveCalls: () => [...saveCalls],
  getContentCalls: () => [...getContentCalls],
  setRemoteEntry: (content, version) => {
    currentRemoteContent = content
    currentRemoteVersion = version
  },
  deleteCalls: () => [...deleteCalls],
  pendingNavigateCalls: () => [...pendingNavigateCalls],
  cancelNavigationCalls: () => [...cancelNavigationCalls],
  menuClickCount: () => menuClickCount,
  dirtyChanges: () => [...dirtyChanges],
  clearCalls: () => {
    saveCalls = []
    deleteCalls = []
    pendingNavigateCalls = []
    cancelNavigationCalls = []
    windowOpenCalls = []
    getContentCalls = []
    menuClickCount = 0
    dirtyChanges = []
    loadCompleteCalls = []
  },
  windowOpenCalls: () => [...windowOpenCalls],
  loadCompleteCalls: () => [...loadCompleteCalls],
  EntryConflictError,
}

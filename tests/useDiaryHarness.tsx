import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useDiary, EntryConflictError } from '../src/hooks/useDiary'
import { clearFolderCache } from '../src/api/driveEntries'
import type { LoadedDiaryEntry } from '../src/types'

type FetchCall = { url: string; method: string }
type QueuedResponse = { status: number; body: unknown }
type SaveResult = { ok: true; result: LoadedDiaryEntry } | { ok: false; conflict: unknown; error: string }

declare global {
  interface Window {
    diaryHarness: {
      /** Queue a response to be consumed by the next fetch call. */
      q: (...responses: QueuedResponse[]) => void
      /** All fetch calls made since last clearCalls(). */
      calls: () => FetchCall[]
      clearCalls: () => void
      /** Mount the component and start the useDiary hook. */
      start: () => void
      save: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<SaveResult>
    }
  }
}

const fetchCalls: FetchCall[] = []
const queue: QueuedResponse[] = []

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  fetchCalls.push({ url: String(input), method: String(init?.method ?? 'GET') })
  const resp = queue.shift()
  if (!resp) throw new Error(`Unexpected fetch: ${String(input)}`)
  return {
    status: resp.status,
    ok: resp.status >= 200 && resp.status < 300,
    json: async () => resp.body,
    text: async () => JSON.stringify(resp.body),
  } as Response
}

clearFolderCache()

type SaveFn = (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
let _save: SaveFn | null = null

function Harness() {
  const diary = useDiary('test-token', () => {})

  useEffect(() => { _save = diary.save })

  return (
    <div
      id={diary.loading ? 'harness-loading' : 'harness-ready'}
      data-dates={diary.dates.join(',')}
    >
      {diary.loading ? 'loading' : 'ready'}
    </div>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)

window.diaryHarness = {
  q: (...responses) => queue.push(...responses),
  calls: () => [...fetchCalls],
  clearCalls: () => fetchCalls.splice(0),
  start: () => root.render(<Harness />),
  save: async (date, content, baseVersion, force) => {
    if (!_save) throw new Error('harness not started')
    try {
      const result = await _save(date, content, baseVersion, force)
      return { ok: true, result }
    } catch (e) {
      if (e instanceof EntryConflictError) {
        return { ok: false, conflict: e.remote, error: 'conflict' }
      }
      return { ok: false, conflict: null, error: String(e) }
    }
  },
}

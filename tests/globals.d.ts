/// <reference types="vite/client" />

interface Window {
  __historyXss?: boolean
  calendarHarness: {
    selectedDates: () => string[]
  }
  themeHarness: {
    mode: () => 'light' | 'dark' | 'system'
    effectiveTheme: () => 'light' | 'dark'
    toggle: () => void
  }
  fontHarness: {
    mode: () => 'serif' | 'sans'
    toggle: () => void
  }
  settingsHarness: {
    render: (opts?: { autoSave?: boolean; modalOpen?: boolean; themeMode?: 'light' | 'dark' | 'system' }) => void
    getStoredAutoSave: () => string | null
    getStoredTheme: () => string | null
    exportCalls: () => { onProgress: (done: number, total: number) => void }[]
    setExportReject: (v: boolean) => void
  }
  searchHarness: {
    render: (opts?: {
      entriesLoading?: boolean
    }) => void
    setSearchResult: (query: string, result: import('../src/hooks/useDiary').SearchResult) => void
    calls: () => string[]
    selectedDates: () => string[]
  }
  diaryHarness: {
    q: (...responses: { status: number; body: unknown; delayMs?: number }[]) => void
    calls: () => { url: string; method: string; body?: string }[]
    clearCalls: () => void
    start: () => void
    save: (
      date: string,
      content: string,
      baseVersion: string | null,
      force?: boolean,
      baseContent?: string | null,
    ) => Promise<
      | { ok: true; result: import('../src/types').LoadedDiaryEntry }
      | { ok: false; conflict: unknown; error: string }
    >
    triggerGetContent: (date: string) => Promise<void>
    search: (query: string) => Promise<import('../src/hooks/useDiary').SearchResult>
    exportAll: () => Promise<{ date: string; content: string }[]>
    refreshEntries: () => Promise<void>
    retryPendingSave: () => Promise<
      | { ok: true; result: import('../src/types').LoadedDiaryEntry | null }
      | { ok: false; conflict: unknown; error: string }
    >
    progressCalls: () => { done: number; total: number }[]
    resetFolderState: () => void
    expiredCalls: () => number
    clearExpiredCalls: () => void
  }
  editorHarness: {
    render: (opts: {
      date?: string
      initialContent?: string
      version?: string | null
      saveReject?: 'conflict' | 'error'
      getContentReject?: 'tokenExpired' | 'error'
      autoSave?: boolean
      getContentDelayMs?: number
      pendingNavDate?: string | null
      token?: string | null
      saveDelayMs?: number
    }) => void
    saveCalls: () => { date: string; content: string; baseVersion: string | null; force?: boolean }[]
    saveCallsWithBaseContent: () => {
      date: string
      content: string
      baseVersion: string | null
      force?: boolean
      baseContent?: string | null
    }[]
    getContentCalls: () => { date: string }[]
    setRemoteEntry: (content: string, version: string | null) => void
    deleteCalls: () => { date: string }[]
    pendingNavigateCalls: () => { date: string | null }[]
    cancelNavigationCalls: () => { date: string | null }[]
    menuClickCount: () => number
    dirtyChanges: () => boolean[]
    clearCalls: () => void
    windowOpenCalls: () => { url: string; target: string }[]
    loadCompleteCalls: () => { date: string; content: string | null; version: string | null }[]
    saveCompleteCalls: () => { date: string; content: string }[]
    EntryConflictError: typeof import('../src/hooks/useDiary').EntryConflictError
    setToken: (token: string | null) => void
    expiredCalls: () => number
  }
  historyHarness: {
    q: (...responses: { status: number; body: unknown; delayMs?: number }[]) => void
    render: (opts?: { date?: string; fileId?: string; baseVersion?: string | null }) => void
    calls: () => { url: string; method: string }[]
    saveCalls: () => { date: string; content: string; baseVersion: string | null; force?: boolean }[]
    saveCallsWithBaseContent: () => {
      date: string
      content: string
      baseVersion: string | null
      force?: boolean
      baseContent?: string | null
    }[]
    restoredCalls: () => import('../src/types').LoadedDiaryEntry[]
    closeCalls: () => number
    expiredCalls: () => number
    setSaveReject: (v: 'conflict' | 'error' | null) => void
  }
  loginScreenHarness: {
    render: (opts?: {
      tokenExpired?: boolean
    }) => void
  }
}

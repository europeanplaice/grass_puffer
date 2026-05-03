/// <reference types="vite/client" />

interface Window {
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
    render: (opts?: { autoSave?: boolean; modalOpen?: boolean }) => void
    getStoredAutoSave: () => string | null
    exportCalls: () => { onProgress: (done: number, total: number) => void }[]
    setExportReject: (v: boolean) => void
  }
  searchHarness: {
    render: (opts?: {
      entriesLoading?: boolean
      indexingProgress?: Partial<import('../src/hooks/useDiary').IndexingProgress>
    }) => void
    setSearchResult: (query: string, result: import('../src/hooks/useDiary').SearchResult) => void
    calls: () => string[]
    selectedDates: () => string[]
  }
  diaryHarness: {
    q: (...responses: { status: number; body: unknown }[]) => void
    calls: () => { url: string; method: string }[]
    clearCalls: () => void
    start: () => void
    save: (
      date: string,
      content: string,
      baseVersion: string | null,
      force?: boolean,
    ) => Promise<
      | { ok: true; result: import('../src/types').LoadedDiaryEntry }
      | { ok: false; conflict: unknown; error: string }
    >
    triggerGetContent: (date: string) => Promise<void>
    resetFolderState: () => void
  }
  editorHarness: {
    render: (opts: {
      date: string
      initialContent: string
      version: string | null
      saveReject?: 'conflict' | 'error'
      autoSave?: boolean
      getContentDelayMs?: number
      pendingNavDate?: string | null
    }) => void
    saveCalls: () => { date: string; content: string; baseVersion: string | null; force?: boolean }[]
    deleteCalls: () => { date: string }[]
    pendingNavigateCalls: () => { date: string | null }[]
    cancelNavigationCalls: () => { date: string | null }[]
    menuClickCount: () => number
    dirtyChanges: () => boolean[]
    clearCalls: () => void
    EntryConflictError: typeof import('../src/hooks/useDiary').EntryConflictError
  }
}

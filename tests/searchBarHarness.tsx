import { createRoot } from 'react-dom/client'
import { SearchBar } from '../src/components/SearchBar'
import type { IndexingProgress, SearchResult } from '../src/hooks/useDiary'

declare global {
  interface Window {
    searchHarness: {
      render: (opts?: { entriesLoading?: boolean; indexingProgress?: Partial<IndexingProgress> }) => void
      setSearchResult: (query: string, result: { results: SearchResult['results']; unindexedCount: number }) => void
      calls: () => string[]
    }
  }
}

const root = createRoot(document.getElementById('root') as HTMLElement)

const callLog: string[] = []
const resultMap = new Map<string, { results: SearchResult['results']; unindexedCount: number }>()

let currentEntriesLoading = false
let currentIndexingProgress: IndexingProgress = { done: 0, total: 0, running: false }

function render() {
  root.render(
    <SearchBar
      entriesLoading={currentEntriesLoading}
      indexingProgress={currentIndexingProgress}
      onSearch={query => {
        callLog.push(query)
        const registered = resultMap.get(query)
        return registered ?? { results: [], unindexedCount: 0 }
      }}
      onSelect={() => {}}
    />,
  )
}

window.searchHarness = {
  render: (opts = {}) => {
    if (opts.entriesLoading !== undefined) currentEntriesLoading = opts.entriesLoading
    if (opts.indexingProgress !== undefined) {
      currentIndexingProgress = { ...currentIndexingProgress, ...opts.indexingProgress }
    }
    render()
  },
  setSearchResult: (query, result) => {
    resultMap.set(query, result)
  },
  calls: () => [...callLog],
}

render()

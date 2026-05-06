import { createRoot } from 'react-dom/client'
import { SearchBar } from '../src/components/SearchBar'
import type { IndexingProgress, SearchResult } from '../src/hooks/useDiary'
import { I18nProvider } from '../src/i18n'

const root = createRoot(document.getElementById('root') as HTMLElement)

const callLog: string[] = []
const selectedDates: string[] = []
const resultMap = new Map<string, SearchResult>()

let currentEntriesLoading = false
let currentIndexingProgress: IndexingProgress = { done: 0, total: 0, running: false }

function render() {
  root.render(
    <I18nProvider>
      <SearchBar
        entriesLoading={currentEntriesLoading}
        indexingProgress={currentIndexingProgress}
        onSearch={query => {
          callLog.push(query)
          const registered = resultMap.get(query)
          return Promise.resolve(registered ?? { results: [], unindexedCount: 0 })
        }}
        onSelect={date => {
          selectedDates.push(date)
        }}
      />
    </I18nProvider>,
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
  selectedDates: () => [...selectedDates],
}

render()

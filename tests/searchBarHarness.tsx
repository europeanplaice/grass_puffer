import React from 'react'
import { createRoot } from 'react-dom/client'
import { SearchBar } from '../src/components/SearchBar'

type SearchResult = { date: string; snippet: string }
type PendingSearch = {
  query: string
  resolve: (results: SearchResult[]) => void
}

declare global {
  interface Window {
    searchHarness: {
      calls: () => string[]
      pending: () => string[]
      render: (entriesLoading: boolean) => void
      resolveByQuery: (query: string, results: SearchResult[]) => void
    }
  }
}

const root = createRoot(document.getElementById('root') as HTMLElement)
const calls: string[] = []
const pending: PendingSearch[] = []
let entriesLoading = false

function render() {
  root.render(
    <SearchBar
      entriesLoading={entriesLoading}
      onSearch={query => {
        calls.push(query)
        return new Promise<SearchResult[]>(resolve => {
          pending.push({ query, resolve })
        })
      }}
      onSelect={() => {}}
    />,
  )
}

window.searchHarness = {
  calls: () => [...calls],
  pending: () => pending.map(search => search.query),
  render: nextEntriesLoading => {
    entriesLoading = nextEntriesLoading
    render()
  },
  resolveByQuery: (query, results) => {
    const index = pending.findIndex(search => search.query === query)
    if (index === -1) throw new Error(`No pending search for ${query}`)
    const [search] = pending.splice(index, 1)
    search.resolve(results)
  },
}

render()

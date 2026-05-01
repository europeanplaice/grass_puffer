import { useEffect, useRef, useState } from 'react'
import type { IndexingProgress, SearchResult } from '../hooks/useDiary'

interface Result {
  date: string
  snippet: string
}

interface Props {
  onSearch: (query: string) => SearchResult
  onSelect: (date: string) => void
  entriesLoading: boolean
  indexingProgress: IndexingProgress
}

const SEARCH_DEBOUNCE_MS = 250

export function SearchBar({ onSearch, onSelect, entriesLoading, indexingProgress }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [unindexedCount, setUnindexedCount] = useState(0)
  const [searched, setSearched] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timerRef.current)
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setUnindexedCount(0)
      setSearched(false)
      return
    }

    if (entriesLoading) {
      setResults([])
      setSearched(false)
      return
    }

    timerRef.current = window.setTimeout(() => {
      const { results: r, unindexedCount: u } = onSearch(query)
      setResults(r)
      setUnindexedCount(u)
      setSearched(true)
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timerRef.current)
  }, [entriesLoading, onSearch, query])

  // Re-run search when indexing completes new entries (progress changes)
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || entriesLoading || !searched) return
    const { results: r, unindexedCount: u } = onSearch(query)
    setResults(r)
    setUnindexedCount(u)
  }, [indexingProgress.done, indexingProgress.running])

  const hasQuery = query.trim().length > 0
  const isIndexing = indexingProgress.running && indexingProgress.total > 0

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search entries..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {isIndexing && (
        <div className="search-status indexing">
          Indexing… {indexingProgress.done}/{indexingProgress.total}
        </div>
      )}
      {entriesLoading && hasQuery && (
        <div className="search-status">Loading entries…</div>
      )}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map(r => (
            <li key={r.date} onClick={() => { onSelect(r.date); setQuery(''); setResults([]); setSearched(false) }}>
              <span className="search-date">{r.date}</span>
              <span className="search-snippet">…{r.snippet}…</span>
            </li>
          ))}
        </ul>
      )}
      {searched && hasQuery && !entriesLoading && unindexedCount > 0 && (
        <div className="search-status">Indexing {unindexedCount} remaining entries…</div>
      )}
      {searched && hasQuery && !entriesLoading && results.length === 0 && unindexedCount === 0 && (
        <div className="search-status">No results</div>
      )}
    </div>
  )
}

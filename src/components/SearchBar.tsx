import { useEffect, useRef, useState } from 'react'
import type { SearchResult } from '../hooks/useDiary'
import { diaryDateLabel } from '../utils/date'

interface Result {
  date: string
  snippet: string
}

interface Props {
  onSearch: (query: string) => Promise<SearchResult>
  onSelect: (date: string) => void
  entriesLoading: boolean
}

const SEARCH_DEBOUNCE_MS = 250

export function SearchBar({ onSearch, onSelect, entriesLoading }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searched, setSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    window.clearTimeout(timerRef.current)
    const trimmed = query.trim()

    if (!trimmed) {
      setResults([])
      setSearched(false)
      setIsSearching(false)
      return
    }

    if (entriesLoading) {
      setResults([])
      setSearched(false)
      return
    }

    timerRef.current = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsSearching(true)
      try {
        const { results: r } = await onSearch(query)
        if (!controller.signal.aborted) {
          setResults(r)
          setSearched(true)
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults([])
          setSearched(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [entriesLoading, onSearch, query])

  const hasQuery = query.trim().length > 0

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search entries..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {isSearching && hasQuery && (
        <div className="search-status">Searching…</div>
      )}
      {entriesLoading && hasQuery && !isSearching && (
        <div className="search-status">Loading entries…</div>
      )}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map(r => (
            <li key={r.date} onClick={() => { onSelect(r.date); setQuery(''); setResults([]); setSearched(false) }}>
              <span className="search-date">{diaryDateLabel(r.date)}</span>
              <span className="search-snippet">…{r.snippet}…</span>
            </li>
          ))}
        </ul>
      )}
      {searched && hasQuery && !entriesLoading && !isSearching && results.length === 0 && (
        <div className="search-status">No results</div>
      )}
    </div>
  )
}

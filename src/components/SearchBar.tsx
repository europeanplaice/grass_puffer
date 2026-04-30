import { useEffect, useRef, useState } from 'react'

interface Result {
  date: string
  snippet: string
}

interface Props {
  onSearch: (query: string) => Promise<Result[]>
  onSelect: (date: string) => void
  entriesLoading: boolean
}

type SearchStatus = 'idle' | 'waiting' | 'searching' | 'done' | 'error'

const SEARCH_DEBOUNCE_MS = 250

export function SearchBar({ onSearch, onSelect, entriesLoading }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [status, setStatus] = useState<SearchStatus>('idle')
  const searchIdRef = useRef(0)

  useEffect(() => {
    const trimmed = query.trim()
    const searchId = searchIdRef.current + 1
    searchIdRef.current = searchId

    if (!trimmed) {
      setResults([])
      setStatus('idle')
      return
    }

    setResults([])

    if (entriesLoading) {
      setStatus('waiting')
      return
    }

    setStatus('waiting')
    const timeoutId = window.setTimeout(() => {
      setStatus('searching')
      onSearch(query)
        .then(r => {
          if (searchIdRef.current !== searchId) return
          setResults(r)
          setStatus('done')
        })
        .catch(() => {
          if (searchIdRef.current !== searchId) return
          setResults([])
          setStatus('error')
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [entriesLoading, onSearch, query])

  const hasQuery = query.trim().length > 0
  const searching = hasQuery && (entriesLoading || status === 'waiting' || status === 'searching')

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search entries..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {searching && (
        <div className="search-status">{entriesLoading ? 'Loading entries…' : 'Searching…'}</div>
      )}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map(r => (
            <li key={r.date} onClick={() => { onSelect(r.date); setQuery(''); setResults([]); setStatus('idle') }}>
              <span className="search-date">{r.date}</span>
              <span className="search-snippet">…{r.snippet}…</span>
            </li>
          ))}
        </ul>
      )}
      {status === 'error' && hasQuery && (
        <div className="search-status error">Search failed</div>
      )}
      {status === 'done' && hasQuery && results.length === 0 && (
        <div className="search-status">No results</div>
      )}
    </div>
  )
}

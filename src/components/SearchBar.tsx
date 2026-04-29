import { useState } from 'react'

interface Result {
  date: string
  snippet: string
}

interface Props {
  onSearch: (query: string) => Promise<Result[]>
  onSelect: (date: string) => void
}

export function SearchBar({ onSearch, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearch = async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const r = await onSearch(q)
    setResults(r)
    setSearching(false)
  }

  return (
    <div className="search-bar">
      <input
        type="search"
        placeholder="Search entries..."
        value={query}
        onChange={e => handleSearch(e.target.value)}
      />
      {searching && <div className="search-status">Searching…</div>}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map(r => (
            <li key={r.date} onClick={() => { onSelect(r.date); setQuery(''); setResults([]) }}>
              <span className="search-date">{r.date}</span>
              <span className="search-snippet">…{r.snippet}…</span>
            </li>
          ))}
        </ul>
      )}
      {!searching && query.trim() && results.length === 0 && (
        <div className="search-status">No results</div>
      )}
    </div>
  )
}

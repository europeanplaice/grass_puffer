import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { SearchResult, IndexingProgress } from '../hooks/useDiary'
import { diaryDateLabel } from '../utils/date'
import { useI18n } from '../i18n'

interface Result {
  date: string
  snippet: string
}

interface Props {
  onSearch: (query: string) => Promise<SearchResult>
  onSelect: (date: string) => void
  entriesLoading: boolean
  indexingProgress?: IndexingProgress
}

const SEARCH_DEBOUNCE_MS = 250

export function SearchBar({ onSearch, onSelect, entriesLoading, indexingProgress }: Props) {
  const { t, locale } = useI18n()
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
  const { done = 0, total = 0, running = false } = indexingProgress ?? {}

  const unindexedCount = total - done

  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <svg className="search-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          placeholder={t.search.placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      {isSearching && hasQuery && (
        <div className="search-status">{t.search.searching}</div>
      )}
      {entriesLoading && hasQuery && !isSearching && (
        <div className="search-status">{t.search.loadingEntries}</div>
      )}
      {running && hasQuery && (
        <div className="search-status">{t.search.indexing(done, total)}</div>
      )}
      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul className="search-results"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
          >
            {results.map(r => (
              <li key={r.date} onClick={() => { onSelect(r.date); setQuery(''); setResults([]); setSearched(false) }}>
                <span className="search-date">{diaryDateLabel(r.date, true, 'long', locale)}</span>
                <span className="search-snippet">…{r.snippet}…</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {searched && hasQuery && !entriesLoading && !isSearching && results.length === 0 && (
        <>
          <div className="search-status">{t.search.noResults}</div>
          {unindexedCount > 0 && (
            <div className="search-status">{t.search.remaining(unindexedCount)}</div>
          )}
        </>
      )}
    </div>
  )
}

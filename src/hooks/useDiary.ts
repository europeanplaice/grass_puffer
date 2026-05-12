import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiaryEntry, DriveFileMeta, LoadedDiaryEntry } from '../types'
import { listEntries, searchEntries, getEntryByDate, saveEntry, deleteEntry, TokenExpiredError } from '../api/driveEntries'

interface EntryCache {
  meta: DriveFileMeta
  content?: DiaryEntry
  snippet?: string
}

export interface DiaryState {
  loading: boolean
  error: string | null
  dates: string[]                                      // sorted desc
  getContent: (date: string) => Promise<LoadedDiaryEntry | null>
  save: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  remove: (date: string) => Promise<void>
  search: (query: string) => Promise<SearchResult>
  retryPendingSave: () => Promise<LoadedDiaryEntry | null>
  exportAll: (onProgress?: (done: number, total: number) => void) => Promise<{ date: string; content: string }[]>
}

export interface SearchResult {
  results: { date: string; snippet: string }[]
  unindexedCount: number
}

export class EntryConflictError extends Error {
  remote: LoadedDiaryEntry | null

  constructor(remote: LoadedDiaryEntry | null) {
    super('Entry was changed on another device')
    this.name = 'EntryConflictError'
    this.remote = remote
  }
}

type PendingSave = { date: string; content: string; baseVersion: string | null }

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const index = nextIndex++
      if (index >= items.length) return
      results.splice(index, 1, await mapper(items.at(index)!, index))
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export function useDiary(isSignedIn: boolean, onExpired: () => void): DiaryState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Map<string, EntryCache>>(new Map())
  const cacheRef = useRef(cache)
  const saveQueueRef = useRef<Map<string, Promise<unknown>>>(new Map())
  const pendingSaveRef = useRef<PendingSave | null>(null)
  const onExpiredRef = useRef(onExpired)
  useEffect(() => { onExpiredRef.current = onExpired })
  useEffect(() => { cacheRef.current = cache }, [cache])

  const updateCache = useCallback((updater: (prev: Map<string, EntryCache>) => Map<string, EntryCache>) => {
    setCache(prev => {
      const next = updater(prev)
      cacheRef.current = next
      return next
    })
  }, [])

  // Load entry list when signed in
  useEffect(() => {
    if (!isSignedIn) {
      const empty = new Map<string, EntryCache>()
      cacheRef.current = empty
      setCache(empty)
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const files = await listEntries()
        const newCache = new Map<string, EntryCache>()
        for (const f of files) {
          const date = f.name.replace('diary-', '').replace('.json', '')
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            newCache.set(date, { meta: f })
          }
        }
        cacheRef.current = newCache
        setCache(newCache)
      } catch (e) {
        if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [isSignedIn])

  const getContent = useCallback(async (date: string): Promise<LoadedDiaryEntry | null> => {
    if (!isSignedIn) return null
    try {
      const cached = cacheRef.current.get(date)
      const loaded = await getEntryByDate(date, cached?.content ? cached.meta.version : undefined)
      if (loaded === 'not-modified') return { entry: cached!.content!, meta: cached!.meta }
      if (!loaded) return null
      const { entry: content, meta } = loaded
      updateCache(prev => {
        const next = new Map(prev)
        const existing = next.get(date)
        if (existing) {
          const existingV = Number(existing.meta.version ?? 0)
          const fetchedV = Number(meta.version ?? 0)
          const safeMeta = fetchedV >= existingV ? meta : existing.meta
          next.set(date, { ...existing, meta: safeMeta, content, snippet: existing.snippet ?? content.content.slice(0, 500) })
        } else {
          next.set(date, { meta, content, snippet: content.content.slice(0, 500) })
        }
        return next
      })
      return { entry: content, meta }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); throw e }
      throw e
    }
  }, [isSignedIn, updateCache])

  const save = useCallback(async (date: string, content: string, baseVersion: string | null, force = false): Promise<LoadedDiaryEntry> => {
    if (!isSignedIn) throw new Error('Not signed in')

    const prev = saveQueueRef.current.get(date) ?? Promise.resolve()
    const run = prev.catch(() => {}).then(async (): Promise<LoadedDiaryEntry> => {
      const entry: DiaryEntry = { date, content, updated_at: new Date().toISOString() }
      try {
        const cachedMeta = cacheRef.current.get(date)?.meta ?? null
        if (cachedMeta) {
          if (!force && cachedMeta.version !== baseVersion) {
            const remote = await getEntryByDate(date)
            if (remote === 'not-modified') throw new Error('Unexpected not-modified')
            throw new EntryConflictError(remote)
          }
          const meta = await saveEntry(date, entry, cachedMeta.id)
          updateCache(p => {
            const next = new Map(p)
            next.set(date, { meta, content: entry, snippet: entry.content.slice(0, 500) })
            return next
          })
          return { entry, meta }
        }

        // New entry — check if another device created it first
        const current = await getEntryByDate(date)
        if (current === 'not-modified') throw new Error('Unexpected not-modified')
        if (!force && (current?.meta.version ?? null) !== baseVersion) {
          throw new EntryConflictError(current)
        }
        const meta = await saveEntry(date, entry, current?.meta.id)
        updateCache(p => {
          const next = new Map(p)
          next.set(date, { meta, content: entry, snippet: entry.content.slice(0, 500) })
          return next
        })
        return { entry, meta }
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          pendingSaveRef.current = { date, content, baseVersion }
          onExpiredRef.current()
          throw e
        }
        throw e
      } finally {
        if (saveQueueRef.current.get(date) === run) saveQueueRef.current.delete(date)
      }
    })
    saveQueueRef.current.set(date, run)
    return run
  }, [isSignedIn, updateCache])

  const remove = useCallback(async (date: string): Promise<void> => {
    if (!isSignedIn) throw new Error('Not signed in')
    const existing = cacheRef.current.get(date)
    if (!existing) return
    try {
      await deleteEntry(date)
      updateCache(prev => {
        const next = new Map(prev)
        next.delete(date)
        return next
      })
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      throw e
    }
  }, [isSignedIn, updateCache])

  const search = useCallback(async (query: string): Promise<SearchResult> => {
    if (!isSignedIn || !query.trim()) return { results: [], unindexedCount: 0 }

    const files = await searchEntries(query)
    const cached = cacheRef.current
    const normalizedQuery = query.toLowerCase()
    const candidates = files
      .map(f => ({ date: f.name.replace('diary-', '').replace('.json', '') }))
      .filter(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date))

    const mapped = await mapWithConcurrency(candidates, 5, async ({ date }) => {
      const cachedEntry = cached.get(date)
      if (cachedEntry?.content) {
        const text = cachedEntry.content.content
        const idx = text.toLowerCase().indexOf(normalizedQuery)
        const snippet = text.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
        return { date, snippet }
      }

      try {
        const loaded = await getEntryByDate(date)
        if (!loaded || loaded === 'not-modified') return null
        const text = loaded.entry.content
        const idx = text.toLowerCase().indexOf(normalizedQuery)
        const snippet = text.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
        updateCache(prev => {
          const next = new Map(prev)
          const ex = next.get(date)
          if (ex) next.set(date, { ...ex, content: loaded.entry, snippet })
          return next
        })
        return { date, snippet }
      } catch {
        // Skip entries that fail to load
        return null
      }
    })

    const results = mapped.filter((r): r is { date: string; snippet: string } => r !== null)
    results.sort((a, b) => b.date.localeCompare(a.date))
    return { results, unindexedCount: 0 }
  }, [isSignedIn, updateCache])

  const retryPendingSave = useCallback(async (): Promise<LoadedDiaryEntry | null> => {
    const pending = pendingSaveRef.current
    if (!pending) return null
    pendingSaveRef.current = null
    return save(pending.date, pending.content, pending.baseVersion)
  }, [save])

  const exportAll = useCallback(async (onProgress?: (done: number, total: number) => void): Promise<{ date: string; content: string }[]> => {
    if (!isSignedIn) throw new Error('Not signed in')

    const dates = Array.from(cache.keys()).sort((a, b) => a.localeCompare(b))
    const total = dates.length
    let done = 0
    const results = await mapWithConcurrency(dates, 4, async (date) => {
      const loaded = await getContent(date)
      done += 1
      onProgress?.(done, total)
      return { date, content: loaded?.entry.content ?? '' }
    })

    return results
  }, [isSignedIn, cache, getContent])

  const dates = Array.from(cache.keys()).sort((a, b) => b.localeCompare(a))

  return { loading, error, dates, getContent, save, remove, search, retryPendingSave, exportAll }
}

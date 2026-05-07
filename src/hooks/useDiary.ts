import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiaryEntry, DriveFileMeta, LoadedDiaryEntry } from '../types'
import { ensureFolder, listEntries, searchEntries, findEntryMeta, getEntry, getEntryMeta, saveEntry, deleteEntry, TokenExpiredError, DriveHttpError, clearFolderCache } from '../api/driveEntries'

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

export interface IndexingProgress {
  done: number
  total: number
  running: boolean
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

export function useDiary(accessToken: string | null, onExpired: () => void): DiaryState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Map<string, EntryCache>>(new Map())
  const cacheRef = useRef(cache)
  const folderIdRef = useRef<string | null>(null)
  const folderLoadPromiseRef = useRef<Promise<string> | null>(null)
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

  const ensureFolderId = useCallback(async (): Promise<string | null> => {
    if (!accessToken) return null
    if (folderIdRef.current) return folderIdRef.current

    if (!folderLoadPromiseRef.current) {
      folderLoadPromiseRef.current = ensureFolder(accessToken)
        .then(folderId => {
          folderIdRef.current = folderId
          return folderId
        })
        .catch(e => {
          folderLoadPromiseRef.current = null
          throw e
        })
    }

    return folderLoadPromiseRef.current
  }, [accessToken])

  const withFolderRetry = useCallback(async <T>(op: (folderId: string) => Promise<T>): Promise<T> => {
    const folderId = await ensureFolderId()
    if (!folderId) throw new Error('Not signed in')
    try {
      return await op(folderId)
    } catch (e) {
      if (e instanceof DriveHttpError && e.status === 404) {
        clearFolderCache()
        folderIdRef.current = null
        folderLoadPromiseRef.current = null
        const fresh = await ensureFolderId()
        if (!fresh) throw e
        return op(fresh)
      }
      throw e
    }
  }, [ensureFolderId])

  // Load entry list when token becomes available
  useEffect(() => {
    if (!accessToken) {
      const emptyCache = new Map<string, EntryCache>()
      cacheRef.current = emptyCache
      setCache(emptyCache)
      folderIdRef.current = null
      folderLoadPromiseRef.current = null
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const folderId = await ensureFolderId()
        if (!folderId) return
        const files = await listEntries(accessToken, folderId)
        const newCache = new Map<string, EntryCache>()
        for (const f of files) {
          // filename: diary-YYYY-MM-DD.json
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
  }, [accessToken, ensureFolderId, updateCache])

  const getContent = useCallback(async (date: string): Promise<LoadedDiaryEntry | null> => {
    if (!accessToken) return null
    try {
      let entry = cacheRef.current.get(date)
      const folderId = folderIdRef.current ?? await ensureFolderId()
      if (!entry && folderId) {
        const meta = await findEntryMeta(accessToken, folderId, date)
        if (!meta) return null
        entry = { meta }
        updateCache(prev => {
          const next = new Map(prev)
          next.set(date, { meta })
          return next
        })
      }
      if (!entry) return null

      const meta = await getEntryMeta(accessToken, entry.meta.id)
      const content = await getEntry(accessToken, entry.meta.id)
      updateCache(prev => {
        const next = new Map(prev)
        const existing = next.get(date)
        if (existing) {
          // Don't let a stale Drive response downgrade the cached version.
          // Drive has no read-your-writes guarantee, so getEntryMeta can return
          // an older version immediately after a save.
          const existingV = Number(existing.meta.version ?? 0)
          const fetchedV = Number(meta.version ?? 0)
          const safeMeta = fetchedV >= existingV ? meta : existing.meta
          next.set(date, { ...existing, meta: safeMeta, content, snippet: existing.snippet ?? content.content.slice(0, 500) })
        }
        return next
      })
      return { entry: content, meta }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); throw e }
      throw e
    }
  }, [accessToken, ensureFolderId, updateCache])

  const save = useCallback(async (date: string, content: string, baseVersion: string | null, force = false): Promise<LoadedDiaryEntry> => {
    if (!accessToken) throw new Error('Not signed in')

    // Serialize saves for the same date: await any in-flight save before starting.
    // This prevents intra-tab autosave/manual-save races from producing false-positive
    // version mismatches. Cross-tab conflicts still surface because the version check
    // runs against the cache, which only the current tab updates.
    const prev = saveQueueRef.current.get(date) ?? Promise.resolve()
    const run = prev.catch(() => {}).then(async (): Promise<LoadedDiaryEntry> => {
      // NOTE: `date` is a local calendar date (YYYY-MM-DD) while `updated_at` is UTC ISO string.
      // This is intentional: the diary date represents the user's local calendar day,
      // while updated_at uses UTC for unambiguous timestamp storage.
      const entry: DiaryEntry = { date, content, updated_at: new Date().toISOString() }
      try {
        return await withFolderRetry(async folderId => {
          const cachedMeta = cacheRef.current.get(date)?.meta ?? null
          if (cachedMeta) {
            // Entry exists in cache: skip the Drive version check entirely.
            // Drive's API has no read-your-writes guarantee, so querying version
            // after a recent save can return stale data and produce false conflicts.
            // Instead we trust the cache, which is updated from PATCH responses and
            // getContent calls — those are the correct sources of truth for conflict detection.
            if (!force && cachedMeta.version !== baseVersion) {
              const remote = { entry: await getEntry(accessToken, cachedMeta.id), meta: cachedMeta }
              throw new EntryConflictError(remote)
            }
            const meta = await saveEntry(accessToken, entry, folderId, cachedMeta.id)
            updateCache(p => {
              const next = new Map(p)
              next.set(date, { meta, content: entry, snippet: entry.content.slice(0, 500) })
              return next
            })
            return { entry, meta }
          }

          // New entry (not in cache): check Drive in case another device created it first.
          const currentMeta = await findEntryMeta(accessToken, folderId, date)
          if (!force && ((currentMeta?.version ?? null) !== baseVersion)) {
            const remote = currentMeta ? { entry: await getEntry(accessToken, currentMeta.id), meta: currentMeta } : null
            throw new EntryConflictError(remote)
          }
          const meta = await saveEntry(accessToken, entry, folderId, currentMeta?.id)
          updateCache(p => {
            const next = new Map(p)
            next.set(date, { meta, content: entry, snippet: entry.content.slice(0, 500) })
            return next
          })
          return { entry, meta }
        })
      } catch (e) {
        if (e instanceof TokenExpiredError) {
          pendingSaveRef.current = { date, content, baseVersion }
          onExpiredRef.current()
          throw e
        }
        throw e
      } finally {
        // Only clear our own entry; a later queued save may have already replaced it.
        if (saveQueueRef.current.get(date) === run) saveQueueRef.current.delete(date)
      }
    })
    saveQueueRef.current.set(date, run)
    return run
  }, [accessToken, withFolderRetry, updateCache])

  const remove = useCallback(async (date: string): Promise<void> => {
    if (!accessToken) throw new Error('Not signed in')
    const existing = cacheRef.current.get(date)
    if (!existing) return
    try {
      await deleteEntry(accessToken, existing.meta.id)
      updateCache(prev => {
        const next = new Map(prev)
        next.delete(date)
        return next
      })
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      throw e
    }
  }, [accessToken, updateCache])

  const search = useCallback(async (query: string): Promise<SearchResult> => {
    if (!accessToken || !query.trim()) return { results: [], unindexedCount: 0 }

    const folderId = folderIdRef.current ?? await ensureFolderId()
    if (!folderId) return { results: [], unindexedCount: 0 }

    // Search Drive API for matching entries
    const files = await searchEntries(accessToken, folderId, query)

    const results: { date: string; snippet: string }[] = []
    const cached = cacheRef.current

    for (const f of files) {
      const date = f.name.replace('diary-', '').replace('.json', '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue

      // Try to get snippet from cache first
      const cachedEntry = cached.get(date)
      if (cachedEntry?.content) {
        const text = cachedEntry.content.content
        const idx = text.toLowerCase().indexOf(query.toLowerCase())
        const snippet = text.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
        results.push({ date, snippet })
      } else {
        // Fetch content for snippet
        try {
          const entry = await getEntry(accessToken, f.id)
          const text = entry.content
          const idx = text.toLowerCase().indexOf(query.toLowerCase())
          const snippet = text.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
          results.push({ date, snippet })
          // Cache the content
          updateCache(prev => {
            const next = new Map(prev)
            const existing = next.get(date)
            if (existing) next.set(date, { ...existing, content: entry, snippet })
            return next
          })
        } catch {
          // Skip entries that fail to load
        }
      }
    }

    results.sort((a, b) => b.date.localeCompare(a.date))
    return { results, unindexedCount: 0 }
  }, [accessToken, ensureFolderId, updateCache])

  const retryPendingSave = useCallback(async (): Promise<LoadedDiaryEntry | null> => {
    const pending = pendingSaveRef.current
    if (!pending) return null
    pendingSaveRef.current = null
    return save(pending.date, pending.content, pending.baseVersion)
  }, [save])

  const exportAll = useCallback(async (onProgress?: (done: number, total: number) => void): Promise<{ date: string; content: string }[]> => {
    if (!accessToken) throw new Error('Not signed in')

    const dates = Array.from(cache.keys()).sort((a, b) => a.localeCompare(b))
    const total = dates.length
    const results: { date: string; content: string }[] = []

    for (let i = 0; i < total; i++) {
      const date = dates[i]
      const loaded = await getContent(date)
      results.push({
        date,
        content: loaded?.entry.content ?? '',
      })
      onProgress?.(i + 1, total)
      if (i < total - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }, [accessToken, cache, getContent])

  const dates = Array.from(cache.keys()).sort((a, b) => b.localeCompare(a))

  return { loading, error, dates, getContent, save, remove, search, retryPendingSave, exportAll }
}

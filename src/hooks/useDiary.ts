import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiaryEntry, DriveFileMeta, LoadedDiaryEntry } from '../types'
import { ensureFolder, listEntries, findEntryMeta, getEntry, getEntryMeta, saveEntry, deleteEntry, TokenExpiredError, DriveHttpError, clearFolderCache } from '../api/driveEntries'

interface EntryCache {
  meta: DriveFileMeta
  content?: DiaryEntry
}

export interface DiaryState {
  loading: boolean
  error: string | null
  dates: string[]                                      // sorted desc
  getContent: (date: string) => Promise<LoadedDiaryEntry | null>
  save: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  remove: (date: string) => Promise<void>
  search: (query: string) => Promise<{ date: string; snippet: string }[]>
}

export class EntryConflictError extends Error {
  remote: LoadedDiaryEntry | null

  constructor(remote: LoadedDiaryEntry | null) {
    super('Entry was changed on another device')
    this.name = 'EntryConflictError'
    this.remote = remote
  }
}

export function useDiary(accessToken: string | null, onExpired: () => void): DiaryState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Map<string, EntryCache>>(new Map())
  const cacheRef = useRef(cache)
  const folderIdRef = useRef<string | null>(null)
  const folderLoadPromiseRef = useRef<Promise<string> | null>(null)
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
  }, [accessToken, ensureFolderId])

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
          next.set(date, { ...existing, meta: safeMeta, content })
        }
        return next
      })
      return { entry: content, meta }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return null }
      throw e
    }
  }, [accessToken, ensureFolderId, updateCache])

  const save = useCallback(async (date: string, content: string, baseVersion: string | null, force = false): Promise<LoadedDiaryEntry> => {
    if (!accessToken) throw new Error('Not signed in')
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
          updateCache(prev => {
            const next = new Map(prev)
            next.set(date, { meta, content: entry })
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
        updateCache(prev => {
          const next = new Map(prev)
          next.set(date, { meta, content: entry })
          return next
        })
        return { entry, meta }
      })
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); throw e }
      throw e
    }
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

  const search = useCallback(async (query: string): Promise<{ date: string; snippet: string }[]> => {
    if (!accessToken || !query.trim()) return []
    const q = query.toLowerCase()
    const results: { date: string; snippet: string }[] = []
    try {
      for (const [date, entry] of cacheRef.current.entries()) {
        const loaded = entry.content ? { entry: entry.content, meta: entry.meta } : await getContent(date)
        if (!loaded) continue
        if (loaded.entry.content.toLowerCase().includes(q)) {
          const idx = loaded.entry.content.toLowerCase().indexOf(q)
          const snippet = loaded.entry.content.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
          results.push({ date, snippet })
        }
      }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return [] }
      throw e
    }
    results.sort((a, b) => b.date.localeCompare(a.date))
    return results
  }, [accessToken, getContent])

  const dates = Array.from(cache.keys()).sort((a, b) => b.localeCompare(a))

  return { loading, error, dates, getContent, save, remove, search }
}

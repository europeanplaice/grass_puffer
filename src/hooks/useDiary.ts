import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiaryEntry, DriveFileMeta, LoadedDiaryEntry } from '../types'
import { ensureFolder, listEntries, findEntryMeta, getEntry, getEntryMeta, saveEntry, deleteEntry, TokenExpiredError } from '../api/driveEntries'

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

  // Load entry list when token becomes available
  useEffect(() => {
    if (!accessToken) {
      const emptyCache = new Map<string, EntryCache>()
      cacheRef.current = emptyCache
      setCache(emptyCache)
      folderIdRef.current = null
      return
    }
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const folderId = await ensureFolder(accessToken)
        folderIdRef.current = folderId
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
  }, [accessToken])

  const getContent = useCallback(async (date: string): Promise<LoadedDiaryEntry | null> => {
    if (!accessToken) return null
    try {
      let entry = cacheRef.current.get(date)
      if (!entry && folderIdRef.current) {
        const meta = await findEntryMeta(accessToken, folderIdRef.current, date)
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
        if (existing) next.set(date, { ...existing, meta, content })
        return next
      })
      return { entry: content, meta }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return null }
      throw e
    }
  }, [accessToken, updateCache])

  const save = useCallback(async (date: string, content: string, baseVersion: string | null, force = false): Promise<LoadedDiaryEntry> => {
    if (!accessToken || !folderIdRef.current) throw new Error('Not signed in')
    const entry: DiaryEntry = { date, content, updated_at: new Date().toISOString() }
    try {
      const currentMeta = await findEntryMeta(accessToken, folderIdRef.current, date)
      if (!force && ((currentMeta?.version ?? null) !== baseVersion)) {
        const remote = currentMeta ? { entry: await getEntry(accessToken, currentMeta.id), meta: currentMeta } : null
        throw new EntryConflictError(remote)
      }

      const meta = await saveEntry(accessToken, entry, folderIdRef.current, currentMeta?.id)
      updateCache(prev => {
        const next = new Map(prev)
        next.set(date, { meta, content: entry })
        return next
      })
      return { entry, meta }
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); throw e }
      throw e
    }
  }, [accessToken, updateCache])

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

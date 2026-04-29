import { useState, useEffect, useCallback, useRef } from 'react'
import type { DiaryEntry, DriveFileMeta } from '../types'
import { ensureFolder, listEntries, getEntry, saveEntry, deleteEntry } from '../api/driveEntries'

interface EntryCache {
  meta: DriveFileMeta
  content?: DiaryEntry
}

export interface DiaryState {
  loading: boolean
  error: string | null
  dates: string[]                                      // sorted desc
  getContent: (date: string) => Promise<DiaryEntry | null>
  save: (date: string, content: string) => Promise<void>
  remove: (date: string) => Promise<void>
  search: (query: string) => Promise<{ date: string; snippet: string }[]>
}

export function useDiary(accessToken: string | null): DiaryState {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Map<string, EntryCache>>(new Map())
  const folderIdRef = useRef<string | null>(null)

  // Load entry list when token becomes available
  useEffect(() => {
    if (!accessToken) {
      setCache(new Map())
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
        setCache(newCache)
      } catch (e) {
        setError(String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [accessToken])

  const getContent = useCallback(async (date: string): Promise<DiaryEntry | null> => {
    if (!accessToken) return null
    const entry = cache.get(date)
    if (!entry) return null
    if (entry.content) return entry.content
    const content = await getEntry(accessToken, entry.meta.id)
    setCache(prev => {
      const next = new Map(prev)
      const existing = next.get(date)
      if (existing) next.set(date, { ...existing, content })
      return next
    })
    return content
  }, [accessToken, cache])

  const save = useCallback(async (date: string, content: string): Promise<void> => {
    if (!accessToken || !folderIdRef.current) throw new Error('Not signed in')
    const entry: DiaryEntry = { date, content, updated_at: new Date().toISOString() }
    const existing = cache.get(date)
    const meta = await saveEntry(accessToken, entry, folderIdRef.current, existing?.meta.id)
    setCache(prev => {
      const next = new Map(prev)
      next.set(date, { meta, content: entry })
      return next
    })
  }, [accessToken, cache])

  const remove = useCallback(async (date: string): Promise<void> => {
    if (!accessToken) throw new Error('Not signed in')
    const existing = cache.get(date)
    if (!existing) return
    await deleteEntry(accessToken, existing.meta.id)
    setCache(prev => {
      const next = new Map(prev)
      next.delete(date)
      return next
    })
  }, [accessToken, cache])

  const search = useCallback(async (query: string): Promise<{ date: string; snippet: string }[]> => {
    if (!accessToken || !query.trim()) return []
    const q = query.toLowerCase()
    const results: { date: string; snippet: string }[] = []
    for (const [date, entry] of cache.entries()) {
      const content = entry.content ?? (await getContent(date))
      if (!content) continue
      if (content.content.toLowerCase().includes(q)) {
        const idx = content.content.toLowerCase().indexOf(q)
        const snippet = content.content.slice(Math.max(0, idx - 30), idx + 60).replace(/\n/g, ' ')
        results.push({ date, snippet })
      }
    }
    results.sort((a, b) => b.date.localeCompare(a.date))
    return results
  }, [accessToken, cache, getContent])

  const dates = Array.from(cache.keys()).sort((a, b) => b.localeCompare(a))

  return { loading, error, dates, getContent, save, remove, search }
}

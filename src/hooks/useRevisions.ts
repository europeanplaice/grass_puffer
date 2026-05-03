import { useState, useEffect, useRef, useCallback } from 'react'
import type { DriveRevisionMeta, LoadedDiaryEntry } from '../types'
import { listRevisions, getRevisionContent } from '../api/driveRevisions'
import { TokenExpiredError } from '../api/driveEntries'
import { EntryConflictError } from './useDiary'

export interface RevisionsState {
  revisions: DriveRevisionMeta[]
  listLoading: boolean
  listError: string | null
  selectedId: string | null
  previewContent: string | null
  previewLoading: boolean
  previewError: string | null
  restoring: boolean
  restoreError: string | null
  selectRevision: (id: string) => void
  restore: () => Promise<void>
}

interface Params {
  token: string
  fileId: string
  date: string
  baseVersion: string | null
  onSave: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  onRestored: (result: LoadedDiaryEntry) => void
  onExpired: () => void
}

export function useRevisions({ token, fileId, date, baseVersion, onSave, onRestored, onExpired }: Params): RevisionsState {
  const [revisions, setRevisions] = useState<DriveRevisionMeta[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const previewAbortRef = useRef<AbortController | null>(null)
  const onExpiredRef = useRef(onExpired)
  useEffect(() => { onExpiredRef.current = onExpired }, [onExpired])

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    setListError(null)
    listRevisions(token, fileId).then(list => {
      if (cancelled) return
      setRevisions(list)
      if (list.length > 0) {
        setSelectedId(list[0].id)
      }
    }).catch(e => {
      if (cancelled) return
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      setListError('Failed to load history.')
    }).finally(() => {
      if (!cancelled) setListLoading(false)
    })
    return () => { cancelled = true }
  }, [token, fileId])

  useEffect(() => {
    if (!selectedId) return
    previewAbortRef.current?.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller

    setPreviewLoading(true)
    setPreviewError(null)
    getRevisionContent(token, fileId, selectedId).then(entry => {
      if (controller.signal.aborted) return
      setPreviewContent(entry.content)
    }).catch(e => {
      if (controller.signal.aborted) return
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      setPreviewError('Failed to load this version.')
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false)
    })
    return () => { controller.abort() }
  }, [token, fileId, selectedId])

  const selectRevision = useCallback((id: string) => {
    setSelectedId(id)
    setRestoreError(null)
  }, [])

  const restore = useCallback(async () => {
    if (!previewContent) return
    setRestoring(true)
    setRestoreError(null)
    try {
      const result = await onSave(date, previewContent, baseVersion)
      onRestored(result)
    } catch (e) {
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      if (e instanceof EntryConflictError) {
        setRestoreError('Could not restore — entry was changed. Please save first.')
      } else {
        setRestoreError('Restore failed.')
      }
    } finally {
      setRestoring(false)
    }
  }, [previewContent, date, baseVersion, onSave, onRestored])

  return {
    revisions,
    listLoading,
    listError,
    selectedId,
    previewContent,
    previewLoading,
    previewError,
    restoring,
    restoreError,
    selectRevision,
    restore,
  }
}

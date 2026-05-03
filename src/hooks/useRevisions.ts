import { useState, useEffect, useRef, useCallback } from 'react'
import type { DriveRevisionMeta, LoadedDiaryEntry } from '../types'
import { listRevisions, getRevisionContent } from '../api/driveRevisions'
import { TokenExpiredError } from '../api/driveEntries'
import { EntryConflictError } from './useDiary'
import * as Diff from 'diff'

export interface RevisionsState {
  revisions: DriveRevisionMeta[]
  listLoading: boolean
  listError: string | null
  selectedId: string | null
  previewContent: string | null
  previewLoading: boolean
  previewError: string | null
  diffHtml: string | null
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
  const [diffHtml, setDiffHtml] = useState<string | null>(null)
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
    const idx = revisions.findIndex(r => r.id === selectedId)
    if (idx === -1) return

    previewAbortRef.current?.abort()
    const controller = new AbortController()
    previewAbortRef.current = controller

    setPreviewLoading(true)
    setPreviewError(null)
    setDiffHtml(null)

    getRevisionContent(token, fileId, selectedId).then(async (current) => {
      if (controller.signal.aborted) return
      const currentContent = current.content
      setPreviewContent(currentContent)

      const prevId = idx < revisions.length - 1 ? revisions[idx + 1].id : null
      if (prevId) {
        try {
          const prev = await getRevisionContent(token, fileId, prevId)
          if (controller.signal.aborted) return

          const diff = Diff.diffLines(prev.content, currentContent)
          const htmlParts = []
          for (const part of diff) {
            const escaped = part.value
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
            const lines = escaped.split('\n')
            // Remove last empty element if the text ends with newline
            if (lines.length > 0 && lines[lines.length - 1] === '') {
              lines.pop()
            }
            for (const line of lines) {
              if (part.added) {
                htmlParts.push(`<div class="diff-add">${line}</div>`)
              } else if (part.removed) {
                htmlParts.push(`<div class="diff-remove">${line}</div>`)
              } else {
                htmlParts.push(`<div>${line}</div>`)
              }
            }
          }
          setDiffHtml(htmlParts.join(''))
        } catch {
          // 前バージョン取得失敗時はdiffなし
          setDiffHtml(null)
        }
      }
    }).catch(e => {
      if (controller.signal.aborted) return
      if (e instanceof TokenExpiredError) { onExpiredRef.current(); return }
      setPreviewError('Failed to load this version.')
    }).finally(() => {
      if (!controller.signal.aborted) setPreviewLoading(false)
    })
    return () => { controller.abort() }
  }, [token, fileId, selectedId, revisions])

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
    diffHtml,
    restoring,
    restoreError,
    selectRevision,
    restore,
  }
}

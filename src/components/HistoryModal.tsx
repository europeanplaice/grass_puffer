import { useEffect, useCallback } from 'react'
import type { LoadedDiaryEntry } from '../types'
import { useRevisions } from '../hooks/useRevisions'

interface Props {
  date: string
  fileId: string
  token: string
  baseVersion: string | null
  text: string
  savedText: string
  isDirty: boolean
  autoSave: boolean
  onSave: (date: string, content: string, baseVersion: string | null, force?: boolean) => Promise<LoadedDiaryEntry>
  onRestored: (result: LoadedDiaryEntry) => void
  onClose: () => void
  onExpired: () => void
}

function formatRevisionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

  if (d.toDateString() === todayStr) return `Today ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`
  if (d.getFullYear() === now.getFullYear()) {
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `${date}, ${time}`
  }
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date}, ${time}`
}

export function HistoryModal({ date, fileId, token, baseVersion, text, savedText, isDirty, autoSave, onSave, onRestored, onClose, onExpired }: Props) {
  const {
    revisions, showUnsavedEntry, listLoading, listError,
    selectedId, previewContent, previewLoading, previewError,
    diffHtml, restoring, restoreError,
    selectRevision, restore,
  } = useRevisions({ token, fileId, date, baseVersion, text, savedText, isDirty, autoSave, onSave, onRestored, onExpired })

  const isCurrentRevision = revisions.length > 0 && selectedId === revisions[0].id
  const isUnsavedRevision = selectedId === '__unsaved__'

  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="history-overlay" onClick={handleOverlayClick}>
      <div className="history-modal" role="dialog" aria-modal="true" aria-label="Version History">
        <div className="history-modal-header">
          <h3>Version History</h3>
          <button className="history-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="history-modal-body">
          <div className="history-revision-list">
            {listLoading && Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="history-skeleton-row" />
            ))}
            {!listLoading && listError && (
              <div className="history-list-error">{listError}</div>
            )}
            {showUnsavedEntry && (
              <div
                className={`history-revision-item${selectedId === '__unsaved__' ? ' selected' : ''}`}
                onClick={() => selectRevision('__unsaved__')}
              >
                <span className="history-revision-time">Unsaved</span>
                <span className="history-revision-badge unsaved-badge">Unsaved</span>
              </div>
            )}
            {!listLoading && !listError && revisions.map((rev, i) => (
              <div
                key={rev.id}
                className={`history-revision-item${selectedId === rev.id ? ' selected' : ''}`}
                onClick={() => selectRevision(rev.id)}
              >
                <span className="history-revision-time">{formatRevisionTime(rev.modifiedTime)}</span>
                {i === 0 && !showUnsavedEntry && <span className="history-revision-badge">Current</span>}
              </div>
            ))}
          </div>
          <div className="history-preview-pane">
            {previewLoading && (
              <div className="history-preview-skeleton">
                {[80, 65, 90, 40, 75, 55].map((w, i) => (
                  <div
                    key={i}
                    className={`history-preview-skeleton-row${w <= 45 ? ' short' : w <= 70 ? ' medium' : ''}`}
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}
            {!previewLoading && previewError && (
              <div className="history-preview-error">{previewError}</div>
            )}
            {!previewLoading && !previewError && (
              <div
                className="history-preview-diff"
                dangerouslySetInnerHTML={{ __html: diffHtml ?? (previewContent ?? '') }}
              />
            )}
            <div className="history-modal-footer">
              {restoreError && <span className="history-restore-error">{restoreError}</span>}
              <button
                className="btn-restore"
                onClick={restore}
                disabled={isCurrentRevision || isUnsavedRevision || restoring || !previewContent}
              >
                {restoring ? 'Restoring…' : 'Restore this version'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

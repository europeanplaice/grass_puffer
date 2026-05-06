import { useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import type { LoadedDiaryEntry } from '../types'
import { useRevisions } from '../hooks/useRevisions'
import { formatRevisionTime } from '../utils/date'
import { useI18n } from '../i18n'

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

export function HistoryModal({ date, fileId, token, baseVersion, text, savedText, isDirty, autoSave, onSave, onRestored, onClose, onExpired }: Props) {
  const { t, locale } = useI18n()
  const {
    revisions, showUnsavedEntry, listLoading, listError,
    selectedId, previewContent, previewLoading, previewError,
    diffHtml, restoring, restoreError,
    selectRevision, restore,
  } = useRevisions({
    token,
    fileId,
    date,
    baseVersion,
    text,
    savedText,
    isDirty,
    autoSave,
    onSave,
    onRestored,
    onExpired,
    messages: {
      failedToLoadHistory: t.history.failedToLoadHistory,
      failedToLoadVersion: t.history.failedToLoadVersion,
      restoreConflict: t.history.restoreConflict,
      restoreFailed: t.history.restoreFailed,
    },
  })

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
    <motion.div className="history-overlay" onClick={handleOverlayClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div className="history-modal" role="dialog" aria-modal="true" aria-label={t.history.title}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        <div className="history-modal-header">
          <h3>{t.history.title}</h3>
          <button className="history-modal-close" onClick={onClose} aria-label={t.common.close}>×</button>
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
                <span className="history-revision-time">{t.history.unsaved}</span>
                <span className="history-revision-badge unsaved-badge">{t.history.unsaved}</span>
              </div>
            )}
            {!listLoading && !listError && revisions.map((rev, i) => (
              <div
                key={rev.id}
                className={`history-revision-item${selectedId === rev.id ? ' selected' : ''}`}
                onClick={() => selectRevision(rev.id)}
              >
                <span className="history-revision-time">{formatRevisionTime(rev.modifiedTime, locale, t.dates)}</span>
                {i === 0 && !showUnsavedEntry && <span className="history-revision-badge">{t.history.current}</span>}
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
                {restoring ? t.history.restoring : t.history.restoreThisVersion}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

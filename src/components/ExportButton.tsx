import { useState, useCallback, useRef, useEffect } from 'react'
import JSZip from 'jszip'
import { useI18n } from '../i18n'

interface ExportButtonProps {
  dates: string[]
  onExport: (onProgress: (done: number, total: number) => void) => Promise<{ date: string; content: string }[]>
}

export function ExportButton({ dates, onExport }: ExportButtonProps) {
  const { t } = useI18n()
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirmOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [confirmOpen])

  const doExport = useCallback(async () => {
    setConfirmOpen(false)
    if (exporting || dates.length === 0) return

    setExporting(true)
    setProgress({ done: 0, total: dates.length })

    try {
      const entries = await onExport((done, total) => {
        setProgress({ done, total })
      })

      const zip = new JSZip()
      for (const { date, content } of entries) {
        zip.file(`diary-${date}.txt`, content)
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `grass_puffer_diary_export_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }, [exporting, dates.length, onExport])

  const handleExportClick = () => {
    if (dates.length === 0) return
    setConfirmOpen(true)
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) setConfirmOpen(false)
  }

  return (
    <div className="settings-export">
      <button
        className="btn-export-modern"
        onClick={handleExportClick}
        disabled={exporting || dates.length === 0}
        title={t.export.title}
      >
        {exporting && progress ? (
          <span className="btn-export-progress">{t.export.progress(progress.done, progress.total)}</span>
        ) : (
          <>
            <svg className="btn-export-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>{t.export.exportAll}</span>
          </>
        )}
      </button>

      {confirmOpen && (
        <div className="export-confirm-overlay" ref={overlayRef} onClick={handleOverlayClick}>
          <div className="export-confirm-modal">
            <h4 className="export-confirm-title">{t.export.confirmTitle}</h4>
            <p className="export-confirm-desc">
              {t.export.confirmDesc(dates.length)}
            </p>
            <div className="export-confirm-actions">
              <button className="export-confirm-cancel" onClick={() => setConfirmOpen(false)}>{t.common.cancel}</button>
              <button className="export-confirm-start" onClick={doExport}>{t.export.start}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

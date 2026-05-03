import { useState, useCallback } from 'react'
import JSZip from 'jszip'

interface ExportButtonProps {
  dates: string[]
  onExport: (onProgress: (done: number, total: number) => void) => Promise<{ date: string; content: string }[]>
}

export function ExportButton({ dates, onExport }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const handleExport = useCallback(async () => {
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

  return (
    <div className="settings-export">
      <button
        className="btn-export-modern"
        onClick={handleExport}
        disabled={exporting || dates.length === 0}
        title="Export all diary entries as ZIP file"
      >
        {exporting && progress ? (
          <span className="btn-export-progress">Exporting... ({progress.done}/{progress.total})</span>
        ) : (
          <>
            <svg className="btn-export-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Export all</span>
          </>
        )}
      </button>
    </div>
  )
}

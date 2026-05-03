import { useCallback, useEffect, useRef } from 'react'
import { ExportButton } from './ExportButton'

interface SettingsModalProps {
  autoSave: boolean
  onAutoSaveToggle: () => void
  dates: string[]
  onExport: (onProgress: (done: number, total: number) => void) => Promise<{ date: string; content: string }[]>
  onClose: () => void
}

export function SettingsModal({ autoSave, onAutoSaveToggle, dates, onExport, onClose }: SettingsModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="settings-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="settings-modal">
        <div className="settings-modal-header">
          <h3>Settings</h3>
          <button className="settings-modal-close" onClick={onClose} aria-label="Close settings">×</button>
        </div>
        <div className="settings-list">
          <div className="settings-item">
            <span className="settings-item-label">Auto-save</span>
            <button
              className={`settings-switch ${autoSave ? 'active' : ''}`}
              onClick={onAutoSaveToggle}
              role="switch"
              aria-checked={autoSave}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-divider" />
          <div className="settings-item">
            <span className="settings-item-label">Export all entries</span>
            <ExportButton dates={dates} onExport={onExport} />
          </div>
        </div>
      </div>
    </div>
  )
}

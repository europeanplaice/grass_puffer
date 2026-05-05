import { useCallback, useEffect, useRef } from 'react'
import { ExportButton } from './ExportButton'

interface SettingsModalProps {
  autoSave: boolean
  onAutoSaveToggle: () => void
  effectiveTheme: 'light' | 'dark'
  onThemeToggle: () => void
  fontMode: 'serif' | 'sans'
  onFontToggle: () => void
  dates: string[]
  onExport: (onProgress: (done: number, total: number) => void) => Promise<{ date: string; content: string }[]>
  onClose: () => void
}

export function SettingsModal({ autoSave, onAutoSaveToggle, effectiveTheme, onThemeToggle, fontMode, onFontToggle, dates, onExport, onClose }: SettingsModalProps) {
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
            <span className="settings-item-label">Dark theme</span>
            <button
              className={`settings-switch ${effectiveTheme === 'dark' ? 'active' : ''}`}
              onClick={onThemeToggle}
              role="switch"
              aria-checked={effectiveTheme === 'dark'}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-divider" />
          <div className="settings-item">
            <span className="settings-item-label">Serif font</span>
            <button
              className={`settings-switch ${fontMode === 'serif' ? 'active' : ''}`}
              onClick={onFontToggle}
              role="switch"
              aria-checked={fontMode === 'serif'}
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-divider" />
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
          <div className="settings-divider" />
          <div className="settings-about">
            <p className="settings-about-title">About data storage</p>
            <p className="settings-about-text">
              Your diary entries are stored in your Google Drive:
            </p>
            <ul className="settings-about-list">
              <li>A folder named <strong>GrassPuffer Diary</strong> is created automatically</li>
              <li>One JSON file per day: <code>diary-YYYY-MM-DD.json</code></li>
              <li>Format: <code>{'{ date, content, updated_at }'}</code></li>
              <li>This app only accesses files it created (scope: drive.file)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

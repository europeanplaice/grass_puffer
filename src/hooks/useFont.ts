import { useState, useEffect, useCallback } from 'react'

type FontMode = 'serif' | 'sans'

const STORAGE_KEY = 'grass_puffer_font'

function readStoredFont(): FontMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'sans') return 'sans'
  return 'serif'
}

function applyFont(mode: FontMode) {
  document.documentElement.setAttribute('data-font', mode)
}

export function useFont() {
  const [mode, setMode] = useState<FontMode>(readStoredFont)

  useEffect(() => {
    applyFont(mode)
  }, [mode])

  const toggleFont = useCallback(() => {
    setMode(prev => {
      const next: FontMode = prev === 'serif' ? 'sans' : 'serif'
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  return { mode, toggleFont }
}

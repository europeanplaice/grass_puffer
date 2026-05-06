import { useState, useEffect, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'grass_puffer_theme'

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function applyTheme(mode: ThemeMode) {
  const effective = mode === 'system' ? getSystemTheme() : mode
  document.documentElement.setAttribute('data-theme', effective)
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(readStoredTheme)

  useEffect(() => {
    applyTheme(mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system') return

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  const effectiveTheme = mode === 'system' ? getSystemTheme() : mode

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next)
    setModeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setMode(effectiveTheme === 'dark' ? 'light' : 'dark')
  }, [effectiveTheme, setMode])

  return { mode, effectiveTheme, setMode, toggleTheme }
}

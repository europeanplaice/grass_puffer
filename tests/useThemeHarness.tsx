import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useTheme } from '../src/hooks/useTheme'

declare global {
  interface Window {
    themeHarness: {
      mode: () => 'light' | 'dark' | 'system'
      effectiveTheme: () => 'light' | 'dark'
      toggle: () => void
    }
  }
}

function Harness() {
  const { mode, effectiveTheme, toggleTheme } = useTheme()

  useEffect(() => {
    window.themeHarness = {
      mode: () => mode,
      effectiveTheme: () => effectiveTheme,
      toggle: toggleTheme,
    }
  }, [mode, effectiveTheme, toggleTheme])

  return (
    <div data-theme={effectiveTheme} data-mode={mode}>
      {mode}
    </div>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<Harness />)

import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useTheme } from '../src/hooks/useTheme'

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

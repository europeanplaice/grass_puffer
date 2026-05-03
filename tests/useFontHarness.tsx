import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { useFont } from '../src/hooks/useFont'

function Harness() {
  const { mode, toggleFont } = useFont()

  useEffect(() => {
    window.fontHarness = {
      mode: () => mode,
      toggle: toggleFont,
    }
  }, [mode, toggleFont])

  return (
    <div data-font={mode}>
      {mode}
    </div>
  )
}

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<Harness />)

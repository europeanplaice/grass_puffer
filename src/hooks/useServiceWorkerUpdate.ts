import { useState, useEffect, useCallback, useRef } from 'react'

interface SwUpdateState {
  updateAvailable: boolean
  applyUpdate: () => void
}

export function useServiceWorkerUpdate(): SwUpdateState {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  const applyUpdate = useCallback(() => {
    const waiting = regRef.current?.waiting
    if (waiting) {
      waiting.postMessage('SKIP_WAITING')
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return
        reloading = true
        window.location.reload()
      }, { once: true })
    } else {
      window.location.reload()
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

    const sw = navigator.serviceWorker
    if (!sw) return

    function onWaiting() {
      setUpdateAvailable(true)
    }

    function watchRegistration(reg: ServiceWorkerRegistration) {
      regRef.current = reg
      if (reg.waiting) onWaiting()
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        if (!installing) return
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && sw.controller) onWaiting()
        })
      })
    }

    sw.ready.then(watchRegistration)

    // Re-check for updates whenever the tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') regRef.current?.update()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return { updateAvailable, applyUpdate }
}

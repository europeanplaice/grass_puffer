import { useState, useEffect } from 'react'

export function useServiceWorkerUpdate(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
    // Only fire for updates. On a first-ever page load there is no previous controller,
    // so `controllerchange` would fire for the first install — suppress that case.
    // This relies on `clients.claim()` in the SW's activate handler so the controller
    // is set immediately after install, not only on next navigation.
    const sw = navigator.serviceWorker
    if (!sw?.controller) return

    const handleControllerChange = () => setUpdateAvailable(true)
    sw.addEventListener('controllerchange', handleControllerChange)
    return () => sw.removeEventListener('controllerchange', handleControllerChange)
  }, [])

  return updateAvailable
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return

  window.addEventListener('load', () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`

    navigator.serviceWorker.register(serviceWorkerUrl).then(registration => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            window.dispatchEvent(new CustomEvent('sw-update-available'))
          }
        })
      })
    }).catch(error => {
      console.warn('Service worker registration failed:', error)
    })
  })
}

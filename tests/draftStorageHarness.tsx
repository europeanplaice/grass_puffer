import { saveDraft, loadDraft, clearDraft, clearAllDrafts } from '../src/utils/draftStorage'

declare global {
  interface Window {
    draftHarness: {
      saveDraft: (date: string, content: string) => void
      loadDraft: (date: string) => string | null
      clearDraft: (date: string) => void
      clearAllDrafts: () => void
      localStorageKeys: () => string[]
      setLocalStorageItem: (key: string, value: string) => void
      breakSetItem: () => void
      restoreSetItem: () => void
    }
  }
}

let originalSetItem: typeof localStorage.setItem | null = null

window.draftHarness = {
  saveDraft,
  loadDraft,
  clearDraft,
  clearAllDrafts,
  localStorageKeys: () => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k !== null) keys.push(k)
    }
    return keys
  },
  setLocalStorageItem: (key, value) => localStorage.setItem(key, value),
  breakSetItem: () => {
    originalSetItem = localStorage.setItem.bind(localStorage)
    Object.defineProperty(localStorage, 'setItem', {
      configurable: true,
      writable: true,
      value: () => { throw new Error('QuotaExceededError') },
    })
  },
  restoreSetItem: () => {
    if (originalSetItem) {
      Object.defineProperty(localStorage, 'setItem', {
        configurable: true,
        writable: true,
        value: originalSetItem,
      })
      originalSetItem = null
    }
  },
}

document.getElementById('root')!.textContent = 'ready'

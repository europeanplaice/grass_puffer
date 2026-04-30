const KEY_PREFIX = 'grass-puffer-draft:'

export function saveDraft(date: string, content: string): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${date}`, content)
  } catch {
    // localStorage may be unavailable (quota exceeded, private mode, etc.)
  }
}

export function loadDraft(date: string): string | null {
  try {
    return localStorage.getItem(`${KEY_PREFIX}${date}`)
  } catch {
    return null
  }
}

export function clearDraft(date: string): void {
  try {
    localStorage.removeItem(`${KEY_PREFIX}${date}`)
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

export function clearAllDrafts(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(KEY_PREFIX)) toRemove.push(key)
    }
    for (const key of toRemove) localStorage.removeItem(key)
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

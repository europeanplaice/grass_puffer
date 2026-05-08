export function startSignIn(returnPath = window.location.pathname + window.location.search + window.location.hash): void {
  window.location.href = `/auth/login?redirect=${encodeURIComponent(returnPath)}`
}

export async function checkSession(): Promise<boolean> {
  try {
    const resp = await fetch('/auth/session', { credentials: 'include' })
    const data = await resp.json() as { signedIn: boolean }
    return Boolean(data.signedIn)
  } catch {
    return false
  }
}

export async function revokeSession(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
}

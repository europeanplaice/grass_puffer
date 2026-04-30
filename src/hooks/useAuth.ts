import { useState, useEffect, useCallback } from 'react'
import { initTokenClient, requestToken, revokeToken } from '../api/gauth'

const RESTORE_FLAG = 'grass-puffer-auth-restorable'

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn'

export interface AuthState {
  accessToken: string | null
  status: AuthStatus
  signIn: () => void
  signOut: () => void
  handleExpired: () => void
}

function canRestoreSession(): boolean {
  try {
    return localStorage.getItem(RESTORE_FLAG) === '1'
  } catch {
    return false
  }
}

function rememberRestorableSession(): void {
  try {
    localStorage.setItem(RESTORE_FLAG, '1')
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

function forgetRestorableSession(): void {
  try {
    localStorage.removeItem(RESTORE_FLAG)
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

export function useAuth(): AuthState {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (
    canRestoreSession() ? 'initializing' : 'signedOut'
  ))

  useEffect(() => {
    let cancelled = false
    let initialized = false

    const acceptToken = (token: string) => {
      if (cancelled) return
      rememberRestorableSession()
      setAccessToken(token)
      setStatus('signedIn')
    }

    const rejectToken = () => {
      if (cancelled) return
      forgetRestorableSession()
      setAccessToken(null)
      setStatus('signedOut')
    }

    const waitForGis = () => {
      if (cancelled || initialized) return
      if (typeof google !== 'undefined') {
        initialized = true
        initTokenClient(acceptToken, rejectToken)
        if (canRestoreSession()) {
          try {
            requestToken({ prompt: 'none' })
          } catch {
            rejectToken()
          }
        } else {
          setStatus('signedOut')
        }
      } else {
        setTimeout(waitForGis, 100)
      }
    }
    waitForGis()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = () => requestToken()

  const signOut = () => {
    if (accessToken) revokeToken(accessToken)
    forgetRestorableSession()
    setAccessToken(null)
    setStatus('signedOut')
  }

  // called when a Drive API call returns 401 (token expired without user action)
  const handleExpired = useCallback(() => {
    forgetRestorableSession()
    setAccessToken(null)
    setStatus('signedOut')
  }, [])

  return { accessToken, status, signIn, signOut, handleExpired }
}

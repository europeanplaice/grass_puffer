import { useState, useEffect, useCallback } from 'react'
import { startSignIn, checkSession, revokeSession } from '../api/auth'

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn'

export interface AuthState {
  status: AuthStatus
  authReady: boolean
  tokenExpired: boolean
  signIn: () => void
  signOut: () => void
  handleExpired: () => void
  retryAfterExpired: () => void
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [tokenExpired, setTokenExpired] = useState(false)

  useEffect(() => {
    let cancelled = false
    checkSession().then(signedIn => {
      if (cancelled) return
      setStatus(signedIn ? 'signedIn' : 'signedOut')
    })
    return () => { cancelled = true }
  }, [])

  const authReady = status !== 'initializing'

  const signIn = useCallback(() => {
    startSignIn()
  }, [])

  const signOut = useCallback(() => {
    revokeSession().catch(() => {})
    setStatus('signedOut')
    setTokenExpired(false)
  }, [])

  const handleExpired = useCallback(() => {
    setTokenExpired(true)
  }, [])

  const retryAfterExpired = useCallback(() => {
    startSignIn()
  }, [])

  return { status, authReady, tokenExpired, signIn, signOut, handleExpired, retryAfterExpired }
}

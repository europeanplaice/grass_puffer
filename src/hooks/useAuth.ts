import { useState, useEffect, useCallback } from 'react'
import { startSignIn, checkSession, revokeSession } from '../api/auth'

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn'

export interface AuthState {
  status: AuthStatus
  authReady: boolean
  tokenExpired: boolean
  hadSession: boolean
  email: string | null
  signIn: () => void
  signOut: () => void
  handleExpired: () => void
  retryAfterExpired: () => void
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>('initializing')
  const [tokenExpired, setTokenExpired] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [hadSession] = useState<boolean>(
    () => localStorage.getItem('grass_puffer_had_session') === 'true'
  )

  useEffect(() => {
    let cancelled = false
    checkSession().then(info => {
      if (cancelled) return
      localStorage.setItem('grass_puffer_had_session', String(info.signedIn))
      setStatus(info.signedIn ? 'signedIn' : 'signedOut')
      setEmail(info.email)
    })
    return () => { cancelled = true }
  }, [])

  const authReady = status !== 'initializing'

  const signIn = useCallback(() => {
    startSignIn()
  }, [])

  const signOut = useCallback(() => {
    revokeSession().catch(() => {})
    localStorage.setItem('grass_puffer_had_session', 'false')
    setStatus('signedOut')
    setTokenExpired(false)
  }, [])

  const handleExpired = useCallback(() => {
    setTokenExpired(true)
  }, [])

  const retryAfterExpired = useCallback(() => {
    startSignIn()
  }, [])

  return { status, authReady, tokenExpired, hadSession, email, signIn, signOut, handleExpired, retryAfterExpired }
}

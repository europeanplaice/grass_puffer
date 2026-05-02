import { useState, useEffect, useCallback, useRef } from 'react'
import { initTokenClient, requestToken, revokeToken } from '../api/gauth'
import type { TokenRequestConfig } from '../api/gauth'

const RESTORE_FLAG = 'grass-puffer-auth-restorable'
const GIS_TIMEOUT_MS = 10_000
const GIS_POLL_MS = 100

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn'

type PendingSignIn = { resolve: () => void; reject: (e: Error) => void }

export interface AuthState {
  accessToken: string | null
  status: AuthStatus
  authReady: boolean
  wasPreviouslySignedIn: boolean
  loadFailed: boolean
  signIn: (config?: TokenRequestConfig) => Promise<void>
  signOut: () => void
  forgetSession: () => void
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

function isTokenRequestConfig(config: unknown): config is TokenRequestConfig {
  return Boolean(config && typeof config === 'object' && 'prompt' in config)
}

export function useAuth(): AuthState {
  const hadRestorableSession = canRestoreSession()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() => (
    hadRestorableSession ? 'initializing' : 'signedOut'
  ))
  const [authReady, setAuthReady] = useState(false)
  const [wasPreviouslySignedIn, setWasPreviouslySignedIn] = useState(hadRestorableSession)
  const [loadFailed, setLoadFailed] = useState(false)
  const pendingSignInRef = useRef<PendingSignIn | null>(null)

  useEffect(() => {
    let cancelled = false
    let initialized = false
    let attempts = 0
    const maxAttempts = GIS_TIMEOUT_MS / GIS_POLL_MS

    const acceptToken = (token: string) => {
      if (cancelled) return
      rememberRestorableSession()
      setWasPreviouslySignedIn(true)
      setAccessToken(token)
      setStatus('signedIn')
      const pending = pendingSignInRef.current
      pendingSignInRef.current = null
      pending?.resolve()
    }

    const rejectToken = () => {
      if (cancelled) return
      forgetRestorableSession()
      setWasPreviouslySignedIn(false)
      setAccessToken(null)
      setStatus('signedOut')
      const pending = pendingSignInRef.current
      pendingSignInRef.current = null
      pending?.reject(new Error('Sign-in cancelled or failed'))
    }

    const waitForGis = () => {
      if (cancelled || initialized) return
      if (typeof google !== 'undefined') {
        initialized = true
        initTokenClient(acceptToken, rejectToken)
        setAuthReady(true)
        setStatus('signedOut')
      } else {
        attempts++
        if (attempts >= maxAttempts) {
          setLoadFailed(true)
          rejectToken()
          return
        }
        setTimeout(waitForGis, GIS_POLL_MS)
      }
    }
    waitForGis()
    return () => {
      cancelled = true
    }
  }, [])

  const signIn = (config?: TokenRequestConfig) => new Promise<void>((resolve, reject) => {
    if (!authReady) {
      reject(new Error('Google Sign-In is not ready'))
      return
    }
    const tokenConfig = isTokenRequestConfig(config) ? config : { prompt: '' }
    pendingSignInRef.current = { resolve, reject }
    try {
      requestToken(tokenConfig)
    } catch (e) {
      pendingSignInRef.current = null
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })

  const signOut = () => {
    if (accessToken) revokeToken(accessToken)
    forgetRestorableSession()
    setWasPreviouslySignedIn(false)
    setAccessToken(null)
    setStatus('signedOut')
  }

  const forgetSession = useCallback(() => {
    forgetRestorableSession()
    setWasPreviouslySignedIn(false)
  }, [])

  // called when a Drive API call returns 401 (token expired without user action)
  const handleExpired = useCallback(() => {
    forgetRestorableSession()
    setWasPreviouslySignedIn(false)
    setAccessToken(null)
    setStatus('signedOut')
  }, [])

  return { accessToken, status, authReady, wasPreviouslySignedIn, loadFailed, signIn, signOut, forgetSession, handleExpired }
}

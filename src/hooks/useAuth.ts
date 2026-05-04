import { useState, useEffect, useCallback, useRef } from 'react'
import { initTokenClient, requestToken, revokeToken } from '../api/gauth'
import type { TokenRequestConfig } from '../api/gauth'

const RESTORE_FLAG = 'grass-puffer-auth-restorable'
const GIS_TIMEOUT_MS = 10_000
const GIS_POLL_MS = 100
const REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh 5 min before expiry

export type AuthStatus = 'initializing' | 'signedOut' | 'signedIn'

type PendingSignIn = { resolve: () => void; reject: (e: Error) => void }

export interface AuthState {
  accessToken: string | null
  status: AuthStatus
  authReady: boolean
  wasPreviouslySignedIn: boolean
  loadFailed: boolean
  tokenExpired: boolean
  signIn: (config?: TokenRequestConfig) => Promise<void>
  signOut: () => void
  forgetSession: () => void
  handleExpired: () => void
  retryAfterExpired: () => void
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
  const [tokenExpired, setTokenExpired] = useState(false)

  const pendingSignInRef = useRef<PendingSignIn | null>(null)
  // Tracks when the current access token expires (ms since epoch)
  const tokenExpiryTimeRef = useRef<number | null>(null)
  // True while a silent background refresh is in flight
  const isBackgroundRefreshRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    let initialized = false
    let attempts = 0
    const maxAttempts = GIS_TIMEOUT_MS / GIS_POLL_MS

    const acceptToken = (token: string, expiresIn: number) => {
      if (cancelled) return
      tokenExpiryTimeRef.current = Date.now() + expiresIn * 1000
      isBackgroundRefreshRef.current = false
      rememberRestorableSession()
      setWasPreviouslySignedIn(true)
      setAccessToken(token)
      setTokenExpired(false)
      setStatus('signedIn')
      const pending = pendingSignInRef.current
      pendingSignInRef.current = null
      pending?.resolve()
    }

    const rejectToken = () => {
      if (cancelled) return
      const wasBackground = isBackgroundRefreshRef.current
      isBackgroundRefreshRef.current = false
      if (wasBackground) {
        // Silent refresh failed — show expired modal without forgetting the session
        tokenExpiryTimeRef.current = null
        setTokenExpired(true)
        setAccessToken(null)
        setStatus('signedOut')
        pendingSignInRef.current = null
        return
      }
      // User-initiated sign-in was cancelled or failed
      forgetRestorableSession()
      setWasPreviouslySignedIn(false)
      setAccessToken(null)
      tokenExpiryTimeRef.current = null
      setTokenExpired(false)
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

  // Proactive silent refresh: fire when user returns to the tab or window
  useEffect(() => {
    const tryRefresh = () => {
      const expiry = tokenExpiryTimeRef.current
      if (!expiry || isBackgroundRefreshRef.current || pendingSignInRef.current) return
      if (Date.now() >= expiry - REFRESH_BUFFER_MS) {
        isBackgroundRefreshRef.current = true
        try {
          requestToken({ prompt: '' })
        } catch {
          isBackgroundRefreshRef.current = false
        }
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') tryRefresh()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', tryRefresh)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', tryRefresh)
    }
  }, [authReady])

  // Proactive silent refresh: schedule a refresh 5 min before the token expires
  // while the tab is kept active and focused
  useEffect(() => {
    if (!accessToken) return
    const expiry = tokenExpiryTimeRef.current
    if (!expiry) return
    const delay = expiry - Date.now() - REFRESH_BUFFER_MS
    if (delay <= 0) return
    const id = setTimeout(() => {
      if (!isBackgroundRefreshRef.current && !pendingSignInRef.current) {
        isBackgroundRefreshRef.current = true
        try {
          requestToken({ prompt: '' })
        } catch {
          isBackgroundRefreshRef.current = false
        }
      }
    }, delay)
    return () => clearTimeout(id)
  }, [accessToken])

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
    tokenExpiryTimeRef.current = null
    forgetRestorableSession()
    setWasPreviouslySignedIn(false)
    setAccessToken(null)
    setTokenExpired(false)
    setStatus('signedOut')
  }

  const forgetSession = useCallback(() => {
    forgetRestorableSession()
    setWasPreviouslySignedIn(false)
  }, [])

  const handleExpired = useCallback(() => {
    tokenExpiryTimeRef.current = null
    setTokenExpired(true)
    setAccessToken(null)
    setStatus('signedOut')
  }, [])

  const retryAfterExpired = useCallback(() => {
    setTokenExpired(false)
    signIn({ prompt: '' }).catch(() => {
      setTokenExpired(true)
    })
  }, [signIn])

  return { accessToken, status, authReady, wasPreviouslySignedIn, loadFailed, tokenExpired, signIn, signOut, forgetSession, handleExpired, retryAfterExpired }
}

import { useState, useEffect } from 'react'
import { initTokenClient, requestToken, revokeToken } from '../api/gauth'

export interface AuthState {
  accessToken: string | null
  signIn: () => void
  signOut: () => void
}

export function useAuth(): AuthState {
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    const waitForGis = () => {
      if (typeof google !== 'undefined') {
        initTokenClient(setAccessToken)
      } else {
        setTimeout(waitForGis, 100)
      }
    }
    waitForGis()
  }, [])

  const signIn = () => requestToken()

  const signOut = () => {
    if (accessToken) revokeToken(accessToken)
    setAccessToken(null)
  }

  return { accessToken, signIn, signOut }
}

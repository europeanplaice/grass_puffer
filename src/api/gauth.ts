const SCOPE = 'https://www.googleapis.com/auth/drive.file'

type TokenClient = google.accounts.oauth2.TokenClient
export type TokenRequestConfig = google.accounts.oauth2.OverridableTokenClientConfig

let tokenClient: TokenClient | null = null
let expectedState: string | null = null

function generateState(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function initTokenClient(
  onToken: (token: string) => void,
  onError: () => void,
): void {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env?.VITE_GOOGLE_CLIENT_ID as string,
    scope: SCOPE,
    prompt: '',
    callback: (resp: google.accounts.oauth2.TokenResponse) => {
      if (resp.error) {
        expectedState = null
        onError()
        return
      }
      if (expectedState && resp.state !== expectedState) {
        expectedState = null
        onError()
        return
      }
      expectedState = null
      onToken(resp.access_token)
    },
    error_callback: () => {
      expectedState = null
      onError()
    },
  })
}

export function requestToken(config?: TokenRequestConfig): void {
  if (!tokenClient) throw new Error('Token client not initialized')
  const state = generateState()
  expectedState = state
  tokenClient.requestAccessToken({ ...config, state })
}

export function revokeToken(token: string): void {
  google.accounts.oauth2.revoke(token, () => {})
}

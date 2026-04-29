const SCOPE = 'https://www.googleapis.com/auth/drive.file'

type TokenClient = google.accounts.oauth2.TokenClient

let tokenClient: TokenClient | null = null

export function initTokenClient(onToken: (token: string) => void): void {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
    scope: SCOPE,
    prompt: '',
    callback: (resp: google.accounts.oauth2.TokenResponse) => {
      if (resp.error) throw new Error(resp.error)
      onToken(resp.access_token)
    },
  })
}

export function requestToken(): void {
  if (!tokenClient) throw new Error('Token client not initialized')
  tokenClient.requestAccessToken()
}

export function revokeToken(token: string): void {
  google.accounts.oauth2.revoke(token, () => {})
}

const SCOPE = 'https://www.googleapis.com/auth/drive.file'

type TokenClient = google.accounts.oauth2.TokenClient
type TokenRequestConfig = google.accounts.oauth2.OverridableTokenClientConfig

let tokenClient: TokenClient | null = null

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
        onError()
        return
      }
      onToken(resp.access_token)
    },
    error_callback: onError,
  })
}

export function requestToken(config?: TokenRequestConfig): void {
  if (!tokenClient) throw new Error('Token client not initialized')
  tokenClient.requestAccessToken(config)
}

export function revokeToken(token: string): void {
  google.accounts.oauth2.revoke(token, () => {})
}

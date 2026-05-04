import { expect, test } from '@playwright/test'
import { initTokenClient, requestToken, revokeToken } from '../src/api/gauth'

type TokenClientConfig = google.accounts.oauth2.TokenClientConfig
type TokenRequestConfig = google.accounts.oauth2.OverridableTokenClientConfig

const originalGoogle = globalThis.google
let tokenClientConfig: TokenClientConfig | null
let tokenRequests: (TokenRequestConfig | undefined)[]
let revokedTokens: string[]

function installGoogleMock(): void {
  tokenClientConfig = null
  tokenRequests = []
  revokedTokens = []

  ;(globalThis as typeof globalThis & { google: typeof google }).google = {
    accounts: {
      oauth2: {
        initTokenClient: (config: TokenClientConfig) => {
          tokenClientConfig = config
          return {
            requestAccessToken: (config?: TokenRequestConfig) => {
              tokenRequests.push(config)
            },
          }
        },
        revoke: (token: string, done: () => void) => {
          revokedTokens.push(token)
          done()
        },
      },
    },
  } as typeof google
}

test.beforeEach(() => {
  installGoogleMock()
})

test.afterEach(() => {
  ;(globalThis as typeof globalThis & { google: typeof google }).google = originalGoogle
})

test.describe('Google auth wrapper', () => {
  test('passes token request overrides through to GIS with state', () => {
    initTokenClient(() => {}, () => {})

    requestToken({ prompt: 'none' })

    expect(tokenRequests.length).toBe(1)
    const req = tokenRequests[0]
    expect(req?.prompt).toBe('none')
    expect(typeof req?.state).toBe('string')
    expect(req?.state?.length).toBeGreaterThan(0)
  })

  test('routes successful token responses to the token handler when state matches', () => {
    let accessToken: string | null = null
    let receivedExpiresIn: number | undefined
    initTokenClient((token, expiresIn) => { accessToken = token; receivedExpiresIn = expiresIn }, () => {})

    requestToken()
    const sentState = tokenRequests[0]?.state as string

    tokenClientConfig?.callback({
      access_token: 'token-1',
      state: sentState,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'https://www.googleapis.com/auth/drive.file',
      prompt: '',
      hd: '',
      client_id: '',
      audiences: [],
    } as unknown as google.accounts.oauth2.TokenResponse)

    expect(accessToken).toBe('token-1')
    expect(receivedExpiresIn).toBe(3600)
  })

  test('calls error handler when state does not match', () => {
    let errors = 0
    initTokenClient(() => {}, () => { errors += 1 })

    requestToken()
    tokenClientConfig?.callback({
      access_token: 'token-1',
      state: 'wrong-state',
    } as google.accounts.oauth2.TokenResponse)

    expect(errors).toBe(1)
  })

  test('routes OAuth errors to error handler and clears state', () => {
    let errors = 0
    initTokenClient(() => {}, () => { errors += 1 })

    requestToken()
    tokenClientConfig?.callback({
      error: 'access_denied',
    } as google.accounts.oauth2.TokenResponse)

    expect(errors).toBe(1)
  })

  test('routes popup errors to error handler and clears state', () => {
    let errors = 0
    initTokenClient(() => {}, () => { errors += 1 })

    requestToken()
    tokenClientConfig?.error_callback?.({
      name: 'Error',
      message: 'Popup window closed',
      type: 'popup_closed',
    })

    expect(errors).toBe(1)
  })

  test('revokes tokens through GIS', () => {
    revokeToken('token-1')

    expect(revokedTokens).toEqual(['token-1'])
  })

  test('defaults expires_in to 3600 when missing from response', () => {
    let receivedExpiresIn: number | undefined
    initTokenClient((_, expiresIn) => { receivedExpiresIn = expiresIn }, () => {})

    requestToken()
    const sentState = tokenRequests[0]?.state as string

    tokenClientConfig?.callback({
      access_token: 'token-1',
      state: sentState,
    } as google.accounts.oauth2.TokenResponse)

     expect(receivedExpiresIn).toBe(3600)
   })
 })

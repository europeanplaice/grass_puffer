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
  test('passes token request overrides through to GIS', () => {
    initTokenClient(() => {}, () => {})

    requestToken({ prompt: 'none' })

    expect(tokenRequests).toEqual([{ prompt: 'none' }])
  })

  test('routes successful token responses to the token handler', () => {
    let accessToken: string | null = null
    let errors = 0
    initTokenClient(token => { accessToken = token }, () => { errors += 1 })

    tokenClientConfig?.callback({
      access_token: 'token-1',
    } as google.accounts.oauth2.TokenResponse)

    expect(accessToken).toBe('token-1')
    expect(errors).toBe(0)
  })

  test('routes OAuth and popup errors to the error handler', () => {
    let accessToken: string | null = null
    let errors = 0
    initTokenClient(token => { accessToken = token }, () => { errors += 1 })

    tokenClientConfig?.callback({
      error: 'access_denied',
    } as google.accounts.oauth2.TokenResponse)
    tokenClientConfig?.error_callback?.({
      name: 'Error',
      message: 'Popup window closed',
      type: 'popup_closed',
    })

    expect(accessToken).toBeNull()
    expect(errors).toBe(2)
  })

  test('revokes tokens through GIS', () => {
    revokeToken('token-1')

    expect(revokedTokens).toEqual(['token-1'])
  })
})

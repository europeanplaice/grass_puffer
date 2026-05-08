import { expect, test } from '@playwright/test'
import { checkSession, revokeSession } from '../src/api/auth'

type FetchCall = { url: string; init?: RequestInit }
type MockResponse = {
  status: number
  ok: boolean
  headers: Headers
  json: () => Promise<unknown>
  text: () => Promise<string>
}

const originalFetch = globalThis.fetch
let calls: FetchCall[]
let responses: MockResponse[]

function jsonResponse(body: unknown, status = 200): MockResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function mockFetch(...nextResponses: MockResponse[]): void {
  responses = [...nextResponses]
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    const response = responses.shift()
    if (!response) throw new Error(`Unexpected fetch: ${String(input)}`)
    return response as Response
  }) as typeof fetch
}

test.beforeEach(() => {
  calls = []
  responses = []
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test.describe('checkSession', () => {
  test('returns true when server responds signedIn: true', async () => {
    mockFetch(jsonResponse({ signedIn: true }))

    const result = await checkSession()

    expect(result).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/auth/session')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('returns false when server responds signedIn: false', async () => {
    mockFetch(jsonResponse({ signedIn: false }))

    const result = await checkSession()

    expect(result).toBe(false)
  })

  test('returns false when fetch throws', async () => {
    globalThis.fetch = async () => { throw new Error('network error') }

    const result = await checkSession()

    expect(result).toBe(false)
  })
})

test.describe('revokeSession', () => {
  test('sends POST to /auth/logout with credentials', async () => {
    mockFetch(jsonResponse(null, 200))

    await revokeSession()

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/auth/logout')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.credentials).toBe('include')
  })
})

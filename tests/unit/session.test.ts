import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  parseSessionId, getSession, saveSession, getValidAccessToken,
  makeSessionCookie, clearSessionCookie, jsonResponse,
} from '../../functions/_shared/session'

describe('jsonResponse', () => {
  it('marks JSON responses as non-cacheable with security headers', () => {
    const response = jsonResponse({ ok: true })

    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })
})

describe('parseSessionId', () => {
  function mockRequest(cookie?: string): Request {
    return new Request('http://localhost', {
      headers: cookie ? { Cookie: cookie } : {},
    })
  }

  it('extracts session cookie from Cookie header', () => {
    expect(parseSessionId(mockRequest('grass_session=abc123; other=val'))).toBe('abc123')
  })

  it('returns null when no Cookie header', () => {
    expect(parseSessionId(mockRequest())).toBeNull()
  })

  it('returns null when session cookie value is empty', () => {
    expect(parseSessionId(mockRequest('grass_session=; other=val'))).toBeNull()
  })

  it('returns null when session cookie is absent', () => {
    expect(parseSessionId(mockRequest('other=val'))).toBeNull()
  })

  it('decodes URI-encoded session ID', () => {
    expect(parseSessionId(mockRequest('grass_session=hello%20world'))).toBe('hello world')
  })
})

describe('getSession', () => {
  it('returns parsed session when KV has a value', async () => {
    const sessionData = { refresh_token: 'rt', access_token: 'at', expires_at: 1000 }
    const env = { SESSIONS: { get: vi.fn().mockResolvedValue(JSON.stringify(sessionData)) } }
    expect(await getSession('sid', env as any)).toEqual(sessionData)
  })

  it('returns null when KV returns null', async () => {
    const env = { SESSIONS: { get: vi.fn().mockResolvedValue(null) } }
    expect(await getSession('sid', env as any)).toBeNull()
  })

  it('returns null when stored JSON is invalid', async () => {
    const env = { SESSIONS: { get: vi.fn().mockResolvedValue('not-json') } }
    expect(await getSession('sid', env as any)).toBeNull()
  })
})

describe('saveSession', () => {
  it('writes session JSON to KV with 30-day TTL', async () => {
    const put = vi.fn()
    const env = { SESSIONS: { put } }
    const session = { refresh_token: 'rt', access_token: 'at', expires_at: 1000 }
    await saveSession('sid', session, env as any)
    expect(put).toHaveBeenCalledWith('session:sid', JSON.stringify(session), { expirationTtl: 60 * 60 * 24 * 30 })
  })
})

describe('makeSessionCookie', () => {
  it('creates a secure HttpOnly session cookie', () => {
    const cookie = makeSessionCookie('abc123', 3600, true)
    expect(cookie).toContain('grass_session=abc123')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=3600')
  })

  it('omits Secure flag when secure=false', () => {
    expect(makeSessionCookie('abc123', 3600, false)).not.toContain('Secure')
  })

  it('encodes the session ID', () => {
    expect(makeSessionCookie('a b', 3600)).toContain('grass_session=a%20b')
  })
})

describe('clearSessionCookie', () => {
  it('creates a cookie with Max-Age=0', () => {
    const cookie = clearSessionCookie(true)
    expect(cookie).toContain('grass_session=')
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('Secure')
  })

  it('omits Secure flag when secure=false', () => {
    expect(clearSessionCookie(false)).not.toContain('Secure')
  })
})

describe('getValidAccessToken', () => {
  const baseEnv = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns current access token when not expired', async () => {
    const session = { refresh_token: 'rt', access_token: 'at', expires_at: Date.now() + 120_000 }
    const result = await getValidAccessToken('sid', session, baseEnv as any)
    expect(result).toBe('at')
  })

  it('does not write to KV when token is still valid', async () => {
    const put = vi.fn()
    const env = { ...baseEnv, SESSIONS: { put } }
    const session = { refresh_token: 'rt', access_token: 'at', expires_at: Date.now() + 120_000 }

    await getValidAccessToken('sid', session, env as any)

    expect(put).not.toHaveBeenCalled()
  })

  it('refreshes token when expired and stores the new token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'new_at', expires_in: 3600 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ))
    const put = vi.fn()
    const env = { ...baseEnv, SESSIONS: { put } }
    const session = { refresh_token: 'rt', access_token: 'old_at', expires_at: Date.now() - 60_000 }

    const result = await getValidAccessToken('sid', session, env as any)

    expect(result).toBe('new_at')
    expect(put).toHaveBeenCalledOnce()
    const stored = JSON.parse(put.mock.calls[0][1])
    expect(stored.access_token).toBe('new_at')
    expect(stored.refresh_token).toBe('rt')
  })

  it('throws when token refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    ))
    const session = { refresh_token: 'rt', access_token: 'old_at', expires_at: Date.now() - 60_000 }

    await expect(getValidAccessToken('sid', session, baseEnv as any)).rejects.toThrow('Token refresh failed: 401')
  })
})

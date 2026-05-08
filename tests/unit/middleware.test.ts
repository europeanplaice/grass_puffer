import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { onRequest } from '../../functions/api/_middleware'

function makeSession(overrides?: Record<string, unknown>) {
  return {
    refresh_token: 'rt',
    access_token: 'at',
    expires_at: Date.now() + 3600_000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('API auth middleware', () => {
  function makeContext(overrides?: Record<string, unknown>) {
    return {
      request: new Request('http://localhost/api/drive/entries'),
      env: {
        SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
        GOOGLE_CLIENT_ID: 'id',
        GOOGLE_CLIENT_SECRET: 'secret',
        SESSION_DOMAIN: 'https://example.com',
      },
      data: {} as Record<string, unknown>,
      next: vi.fn().mockReturnValue(new Response('ok')),
      ...overrides,
    }
  }

  it('returns 401 when no session cookie', async () => {
    const ctx = makeContext()

    const response = await onRequest(ctx as any)

    expect(response.status).toBe(401)
    expect(ctx.next).not.toHaveBeenCalled()
  })

  it('returns 401 when session not in KV', async () => {
    const ctx = makeContext({
      request: new Request('http://localhost/api/drive/entries', {
        headers: { Cookie: 'grass_session=sid123' },
      }),
      env: { SESSIONS: { get: vi.fn().mockResolvedValue(null) } },
    })

    const response = await onRequest(ctx as any)

    expect(response.status).toBe(401)
    expect(ctx.next).not.toHaveBeenCalled()
  })

  it('returns 401 when token refresh fails', async () => {
    const expiredSession = makeSession({ expires_at: Date.now() - 60_000 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })))
    const ctx = makeContext({
      request: new Request('http://localhost/api/drive/entries', {
        headers: { Cookie: 'grass_session=sid123' },
      }),
      env: { SESSIONS: { get: vi.fn().mockResolvedValue(JSON.stringify(expiredSession)), put: vi.fn() } },
    })

    const response = await onRequest(ctx as any)

    expect(response.status).toBe(401)
    expect(ctx.next).not.toHaveBeenCalled()
  })

  it('calls next() with sessionId and accessToken in data', async () => {
    const session = makeSession()
    const ctx = makeContext({
      request: new Request('http://localhost/api/drive/entries', {
        headers: { Cookie: 'grass_session=sid123' },
      }),
      env: { SESSIONS: { get: vi.fn().mockResolvedValue(JSON.stringify(session)), put: vi.fn() } },
    })

    const response = await onRequest(ctx as any)

    expect(response.status).toBe(200)
    expect(ctx.data.sessionId).toBe('sid123')
    expect(ctx.data.accessToken).toBe('at')
    expect(ctx.next).toHaveBeenCalledOnce()
  })
})

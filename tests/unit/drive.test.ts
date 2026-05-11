import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  ensureFolder, getEntryContent, saveEntry, deleteEntry,
  listRevisions, getRevisionContent, DriveError,
} from '../../functions/_shared/drive'

function mockFetch(response: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

function driveJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('DriveError', () => {
  it('captures status and message', () => {
    const e = new DriveError(404, 'Not found')
    expect(e.status).toBe(404)
    expect(e.message).toBe('Not found')
    expect(e.name).toBe('DriveError')
  })
})

describe('ensureFolder', () => {
  it('returns cached folder_id from session', async () => {
    const session = { refresh_token: 'rt', access_token: 'at', expires_at: 1000, folder_id: 'cached' }
    const env = { SESSIONS: { put: vi.fn() } }
    const result = await ensureFolder('token', 'sid', session, env as any)
    expect(result).toBe('cached')
  })

  it('finds existing folder on Drive', async () => {
    mockFetch(driveJsonResponse({ files: [{ id: 'existing-folder' }] }))
    const put = vi.fn()
    const env = { SESSIONS: { put } }
    const session: any = { refresh_token: 'rt', access_token: 'at', expires_at: 1000 }

    const result = await ensureFolder('token', 'sid', session, env as any)

    expect(result).toBe('existing-folder')
    expect(session.folder_id).toBe('existing-folder')
    expect(put).toHaveBeenCalledOnce()
  })

  it('creates folder when none exists on Drive', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(driveJsonResponse({ files: [] }))
      .mockResolvedValueOnce(driveJsonResponse({ id: 'new-folder' })))
    const put = vi.fn()
    const env = { SESSIONS: { put } }
    const session: any = { refresh_token: 'rt', access_token: 'at', expires_at: 1000 }

    const result = await ensureFolder('token', 'sid', session, env as any)
    expect(result).toBe('new-folder')
  })
})

describe('getEntryContent', () => {
  it('fetches entry content from Drive', async () => {
    const entry = { date: '2026-05-01', content: 'hello', updated_at: '2026-05-01T00:00:00.000Z' }
    mockFetch(driveJsonResponse(entry))

    const result = await getEntryContent('token', 'file-123')
    expect(result).toEqual(entry)
    const fetchCall = (vi.mocked(fetch).mock.calls[0] as any)
    expect(fetchCall[1].headers['Accept-Encoding']).toBe('gzip')
    expect(fetchCall[1].headers['User-Agent']).toContain('(gzip)')
  })

  it('retries on 429 then succeeds', async () => {
    const entry = { date: '2026-05-01', content: 'hello', updated_at: '' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('Too Many Requests', { status: 429 }))
      .mockResolvedValueOnce(driveJsonResponse(entry)))

    const result = await getEntryContent('token', 'file-123')
    expect(result.content).toBe('hello')
  })

  it('retries on 500 then succeeds', async () => {
    const entry = { date: '2026-05-01', content: 'ok', updated_at: '' }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(driveJsonResponse(entry)))

    const result = await getEntryContent('token', 'file-123')
    expect(result.content).toBe('ok')
  })

  it('throws DriveError after exhausting all retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
      Promise.resolve(new Response('Server Error', { status: 503 })),
    ))

    await expect(getEntryContent('token', 'file-123')).rejects.toThrow(DriveError)
  })

  it('throws DriveError immediately on 404 (no retry)', async () => {
    mockFetch(new Response('Not Found', { status: 404 }))

    await expect(getEntryContent('token', 'file-123')).rejects.toThrow(DriveError)
  })

  it('respects Retry-After header', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5) // neutralise jitter: factor = 1.0
    try {
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const entry = { date: '2026-05-01', content: 'ok', updated_at: '' }
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response('Rate Limited', { status: 429, headers: { 'Retry-After': '1' } }))
        .mockResolvedValueOnce(driveJsonResponse(entry)))

      const promise = getEntryContent('token', 'file-123')
      await vi.runAllTimersAsync()
      await promise

      const delayArg = setTimeoutSpy.mock.calls[0][1] as number
      expect(delayArg).toBe(1000)
    } finally {
      vi.mocked(Math.random).mockRestore()
      vi.useRealTimers()
    }
  })
})

describe('saveEntry', () => {
  it('PATCHes when fileId is provided (update)', async () => {
    const meta = { id: 'file-1', name: 'diary-2026-05-01.json', version: '2' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(driveJsonResponse(meta)))
    const entry = { date: '2026-05-01', content: 'updated', updated_at: '2026-05-01T00:00:00.000Z' }

    const result = await saveEntry('token', entry, 'folder-1', 'file-1')

    expect(result.version).toBe('2')
    const fetchCall = (vi.mocked(fetch).mock.calls[0] as any)
    expect(fetchCall[0]).toContain('/files/file-1')
    expect(fetchCall[1].method).toBe('PATCH')
  })

  it('POSTes when no fileId (create)', async () => {
    const meta = { id: 'new-file', name: 'diary-2026-05-01.json', version: '1' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(driveJsonResponse(meta)))
    const entry = { date: '2026-05-01', content: 'new', updated_at: '2026-05-01T00:00:00.000Z' }

    const result = await saveEntry('token', entry, 'folder-1')

    expect(result.version).toBe('1')
    const fetchCall = (vi.mocked(fetch).mock.calls[0] as any)
    expect(fetchCall[0]).toContain('/files?uploadType=multipart')
    expect(fetchCall[1].method).toBe('POST')
  })

  it('builds multipart body with boundary', async () => {
    const meta = { id: 'f', name: 'diary-2026-05-01.json', version: '1' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(driveJsonResponse(meta)))
    const entry = { date: '2026-05-01', content: 'test', updated_at: '2026-05-01T00:00:00.000Z' }

    await saveEntry('token', entry, 'folder-1')

    const fetchCall = (vi.mocked(fetch).mock.calls[0] as any)
    const contentType = fetchCall[1].headers['Content-Type']
    expect(contentType).toContain('multipart/related')
    expect(contentType).toContain('boundary=grass_puffer_boundary')
    expect(fetchCall[1].body).toContain('grass_puffer_boundary')
  })
})

describe('deleteEntry', () => {
  it('sends DELETE request and returns void', async () => {
    const delFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', delFetch)

    await deleteEntry('token', 'file-1')

    const call = delFetch.mock.calls[0] as any
    expect(call[0]).toContain('/files/file-1')
    expect(call[1].method).toBe('DELETE')
  })
})

describe('listRevisions', () => {
  it('returns revisions in reverse order (newest first)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      driveJsonResponse({ revisions: [{ id: '1' }, { id: '2' }, { id: '3' }] })))

    const result = await listRevisions('token', 'file-1')

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('3')
    expect(result[2].id).toBe('1')
  })

  it('returns empty array when there are no revisions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      driveJsonResponse({ revisions: [] })))

    const result = await listRevisions('token', 'file-1')
    expect(result).toEqual([])
  })
})

describe('getRevisionContent', () => {
  it('fetches revision content with alt=media', async () => {
    const entry = { date: '2026-05-01', content: 'rev', updated_at: '2026-05-01T00:00:00.000Z' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(driveJsonResponse(entry)))

    const result = await getRevisionContent('token', 'file-1', 'rev-1')
    expect(result).toEqual(entry)
  })
})

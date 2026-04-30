import { expect, test } from '@playwright/test'
import type { DriveFileMeta } from '../src/types'
import {
  TokenExpiredError,
  DriveHttpError,
  clearFolderCache,
  deleteEntry,
  ensureFolder,
  findEntryMeta,
  getEntry,
  listEntries,
  saveEntry,
} from '../src/api/driveEntries'

type FetchCall = {
  url: string
  init?: RequestInit
}

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

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): MockResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(extraHeaders),
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function textResponse(body: string, status: number, extraHeaders?: Record<string, string>): MockResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: new Headers(extraHeaders),
    json: async () => JSON.parse(body),
    text: async () => body,
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
  clearFolderCache()
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
  clearFolderCache()
})

test.describe('driveEntries API helpers', () => {
  test('ensureFolder reuses an existing Drive folder and caches its id', async () => {
    mockFetch(jsonResponse({ files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] }))

    await expect(ensureFolder('token-1')).resolves.toBe('folder-1')
    await expect(ensureFolder('token-1')).resolves.toBe('folder-1')

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/drive/v3/files?q=')
    expect(decodeURIComponent(calls[0].url)).toContain("name='GrassPuffer Diary'")
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
  })

  test('ensureFolder creates the diary folder when Drive has none', async () => {
    mockFetch(
      jsonResponse({ files: [] }),
      jsonResponse({ id: 'created-folder', name: 'GrassPuffer Diary' }),
    )

    await expect(ensureFolder('token-1')).resolves.toBe('created-folder')

    expect(calls).toHaveLength(2)
    expect(calls[1].url).toBe('https://www.googleapis.com/drive/v3/files')
    expect(calls[1].init).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-1',
        'Content-Type': 'application/json',
      },
    })
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      name: 'GrassPuffer Diary',
      mimeType: 'application/vnd.google-apps.folder',
    })
  })

  test('lists and finds diary file metadata with Drive query filters', async () => {
    const files: DriveFileMeta[] = [
      { id: 'entry-1', name: 'diary-2026-04-29.json', version: '11' },
    ]
    mockFetch(jsonResponse({ files }), jsonResponse({ files }))

    await expect(listEntries('token-1', 'folder-1')).resolves.toEqual(files)
    await expect(findEntryMeta('token-1', 'folder-1', '2026-04-29')).resolves.toEqual(files[0])

    expect(decodeURIComponent(calls[0].url)).toContain("'folder-1' in parents")
    expect(decodeURIComponent(calls[0].url)).toContain("mimeType='application/json'")
    expect(decodeURIComponent(calls[1].url)).toContain("name='diary-2026-04-29.json'")
    expect(calls[1].url).toContain('pageSize=1')
  })

  test('loads an entry file as media', async () => {
    const entry = { date: '2026-04-29', content: 'today', updated_at: '2026-04-29T00:00:00.000Z' }
    mockFetch(jsonResponse(entry))

    await expect(getEntry('token-1', 'entry-1')).resolves.toEqual(entry)

    expect(calls[0].url).toBe('https://www.googleapis.com/drive/v3/files/entry-1?alt=media')
    expect(calls[0].init?.headers).toMatchObject({ Authorization: 'Bearer token-1' })
  })

  test('saves new and existing entries using multipart upload', async () => {
    const entry = { date: '2026-04-29', content: 'saved text', updated_at: '2026-04-29T00:00:00.000Z' }
    mockFetch(
      jsonResponse({ id: 'entry-1', name: 'diary-2026-04-29.json', version: '1' }),
      jsonResponse({ id: 'entry-1', name: 'diary-2026-04-29.json', version: '2' }),
    )

    await expect(saveEntry('token-1', entry, 'folder-1')).resolves.toMatchObject({ version: '1' })
    await expect(saveEntry('token-1', entry, 'folder-1', 'entry-1')).resolves.toMatchObject({ version: '2' })

    expect(calls[0].url).toContain('/upload/drive/v3/files?uploadType=multipart')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.headers).toMatchObject({
      Authorization: 'Bearer token-1',
      'Content-Type': 'multipart/related; boundary=grass_puffer_boundary',
    })
    expect(String(calls[0].init?.body)).toContain('"parents":["folder-1"]')
    expect(String(calls[0].init?.body)).toContain('"content":"saved text"')

    expect(calls[1].url).toContain('/upload/drive/v3/files/entry-1?uploadType=multipart')
    expect(calls[1].init?.method).toBe('PATCH')
    expect(String(calls[1].init?.body)).toContain('{}')
  })

  test('deletes entries and maps Drive errors', async () => {
    // 500 triggers retries (4 total attempts needed before throwing)
    mockFetch(
      textResponse('', 204),
      textResponse('expired', 401),
      textResponse('nope', 500),
      textResponse('nope', 500),
      textResponse('nope', 500),
      textResponse('nope', 500),
    )

    await expect(deleteEntry('token-1', 'entry-1')).resolves.toBeUndefined()
    await expect(deleteEntry('token-1', 'entry-2')).rejects.toBeInstanceOf(TokenExpiredError)
    await expect(deleteEntry('token-1', 'entry-3')).rejects.toThrow('Drive API 500: nope')

    expect(calls[0]).toMatchObject({
      url: 'https://www.googleapis.com/drive/v3/files/entry-1',
      init: {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-1' },
      },
    })
  })
})

test.describe('withRetry behaviour', () => {
  test('503 retries and succeeds on second attempt', async () => {
    mockFetch(
      textResponse('unavailable', 503, { 'Retry-After': '0.01' }),
      jsonResponse({ files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] }),
    )

    await expect(ensureFolder('token-1')).resolves.toBe('folder-1')
    expect(calls).toHaveLength(2)
  })

  test('429 with Retry-After: 0.1 completes faster than default 250ms backoff', async () => {
    // Default first-attempt delay is 250ms; Retry-After: 0.1 sets it to 100ms.
    // With jitter the total should still be well under 300ms.
    mockFetch(
      textResponse('rate limited', 429, { 'Retry-After': '0.1' }),
      jsonResponse({ files: [{ id: 'folder-x', name: 'GrassPuffer Diary' }] }),
    )

    const t0 = Date.now()
    await expect(ensureFolder('token-2')).resolves.toBe('folder-x')
    const elapsed = Date.now() - t0

    expect(elapsed).toBeLessThan(300)
    expect(calls).toHaveLength(2)
  })

  test('401 throws TokenExpiredError immediately without retry', async () => {
    mockFetch(textResponse('expired', 401))

    await expect(ensureFolder('token-bad')).rejects.toBeInstanceOf(TokenExpiredError)
    expect(calls).toHaveLength(1)
  })

  test('404 throws DriveHttpError with status 404 without retry', async () => {
    mockFetch(textResponse('not found', 404))

    const err = await ensureFolder('token-1').catch(e => e)
    expect(err).toBeInstanceOf(DriveHttpError)
    expect((err as DriveHttpError).status).toBe(404)
    expect(calls).toHaveLength(1)
  })

  test('500 repeated 4 times throws DriveHttpError after exhausting retries', async () => {
    // withRetry delays: [250,500,1000]; attempt 0,1,2 retry; attempt 3 throws.
    // Use Retry-After: 0.01 on each response to keep the test fast (~120ms total).
    const r500 = () => textResponse('server error', 500, { 'Retry-After': '0.01' })
    mockFetch(r500(), r500(), r500(), r500())

    const err = await ensureFolder('token-1').catch(e => e)
    expect(err).toBeInstanceOf(DriveHttpError)
    expect((err as DriveHttpError).status).toBe(500)
    expect(calls).toHaveLength(4)
  })
})

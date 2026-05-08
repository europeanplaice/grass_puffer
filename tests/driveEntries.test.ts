import { expect, test } from '@playwright/test'
import type { DriveFileMeta } from '../src/types'
import {
  TokenExpiredError,
  DriveHttpError,
  listEntries,
  searchEntries,
  getEntryByDate,
  saveEntry,
  deleteEntry,
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
})

test.afterEach(() => {
  globalThis.fetch = originalFetch
})

test.describe('driveEntries proxy API', () => {
  test('listEntries calls /api/drive/entries with credentials', async () => {
    const files: DriveFileMeta[] = [
      { id: 'entry-1', name: 'diary-2026-04-29.json', version: '11' },
    ]
    mockFetch(jsonResponse({ files }))

    const result = await listEntries()

    expect(result).toEqual(files)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/drive/entries')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('listEntries returns empty array when files missing', async () => {
    mockFetch(jsonResponse({}))

    const result = await listEntries()

    expect(result).toEqual([])
  })

  test('searchEntries calls /api/drive/search with encoded query', async () => {
    const files: DriveFileMeta[] = [{ id: 'e-1', name: 'diary-2026-05-01.json', version: '1' }]
    mockFetch(jsonResponse({ files }))

    const result = await searchEntries('hello world')

    expect(result).toEqual(files)
    expect(calls[0].url).toContain('/api/drive/search?q=')
    expect(decodeURIComponent(calls[0].url)).toContain('hello world')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('getEntryByDate returns entry and meta on success', async () => {
    const entry = { date: '2026-04-29', content: 'today', updated_at: '2026-04-29T00:00:00.000Z' }
    const meta = { id: 'entry-1', name: 'diary-2026-04-29.json', version: '3' }
    mockFetch(jsonResponse({ entry, meta }))

    const result = await getEntryByDate('2026-04-29')

    expect(result).toEqual({ entry, meta })
    expect(calls[0].url).toBe('/api/drive/entry/2026-04-29')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('getEntryByDate returns null on 404', async () => {
    mockFetch(jsonResponse(null, 404))

    const result = await getEntryByDate('2026-04-29')

    expect(result).toBeNull()
  })

  test('saveEntry posts JSON to /api/drive/entry/:date', async () => {
    const meta: DriveFileMeta = { id: 'entry-1', name: 'diary-2026-04-29.json', version: '1' }
    mockFetch(jsonResponse(meta))

    const entry = { date: '2026-04-29', content: 'saved text', updated_at: '2026-04-29T00:00:00.000Z' }
    const result = await saveEntry('2026-04-29', entry)

    expect(result).toEqual(meta)
    expect(calls[0].url).toBe('/api/drive/entry/2026-04-29')
    expect(calls[0].init?.method).toBe('POST')
    expect(calls[0].init?.credentials).toBe('include')
    const body = JSON.parse(String(calls[0].init?.body))
    expect(body.content).toBe('saved text')
    expect(body.fileId).toBeUndefined()
  })

  test('saveEntry includes fileId when provided', async () => {
    const meta: DriveFileMeta = { id: 'entry-1', name: 'diary-2026-04-29.json', version: '2' }
    mockFetch(jsonResponse(meta))

    const entry = { date: '2026-04-29', content: 'updated', updated_at: '2026-04-29T00:00:00.000Z' }
    await saveEntry('2026-04-29', entry, 'entry-1')

    const body = JSON.parse(String(calls[0].init?.body))
    expect(body.fileId).toBe('entry-1')
  })

  test('deleteEntry sends DELETE to /api/drive/entry/:date', async () => {
    mockFetch(textResponse('', 204))

    await expect(deleteEntry('2026-04-29')).resolves.toBeUndefined()

    expect(calls[0].url).toBe('/api/drive/entry/2026-04-29')
    expect(calls[0].init?.method).toBe('DELETE')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('throws TokenExpiredError on 401', async () => {
    mockFetch(textResponse('expired', 401))

    await expect(listEntries()).rejects.toBeInstanceOf(TokenExpiredError)
  })

  test('throws DriveHttpError on non-retryable error', async () => {
    mockFetch(textResponse('forbidden', 403))

    const err = await listEntries().catch(e => e)
    expect(err).toBeInstanceOf(DriveHttpError)
    expect((err as DriveHttpError).status).toBe(403)
  })
})

test.describe('retry behaviour', () => {
  test('503 retries and succeeds on second attempt', async () => {
    mockFetch(
      textResponse('unavailable', 503, { 'Retry-After': '0.01' }),
      jsonResponse({ files: [] }),
    )

    await expect(listEntries()).resolves.toEqual([])
    expect(calls).toHaveLength(2)
  })

  test('429 with Retry-After: 0.1 completes faster than default 250ms backoff', async () => {
    mockFetch(
      textResponse('rate limited', 429, { 'Retry-After': '0.1' }),
      jsonResponse({ files: [] }),
    )

    const t0 = Date.now()
    await expect(listEntries()).resolves.toEqual([])
    const elapsed = Date.now() - t0

    expect(elapsed).toBeLessThan(300)
    expect(calls).toHaveLength(2)
  })

  test('401 throws TokenExpiredError immediately without retry', async () => {
    mockFetch(textResponse('expired', 401))

    await expect(listEntries()).rejects.toBeInstanceOf(TokenExpiredError)
    expect(calls).toHaveLength(1)
  })

  test('500 repeated 4 times throws DriveHttpError after exhausting retries', async () => {
    const r500 = () => textResponse('server error', 500, { 'Retry-After': '0.01' })
    mockFetch(r500(), r500(), r500(), r500())

    const err = await listEntries().catch(e => e)
    expect(err).toBeInstanceOf(DriveHttpError)
    expect((err as DriveHttpError).status).toBe(500)
    expect(calls).toHaveLength(4)
  })
})

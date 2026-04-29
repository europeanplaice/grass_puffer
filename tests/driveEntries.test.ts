import { expect, test } from '@playwright/test'
import type { DriveFileMeta } from '../src/types'
import {
  TokenExpiredError,
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
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function textResponse(body: string, status: number): MockResponse {
  return {
    status,
    ok: status >= 200 && status < 300,
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
    mockFetch(textResponse('', 204), textResponse('expired', 401), textResponse('nope', 500))

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

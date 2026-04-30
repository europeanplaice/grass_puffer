import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let baseUrl: string

const FOLDER_INIT = { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] }
const ENTRIES_EMPTY = { files: [] }

function fileMeta(version: string, id = 'file-1') {
  return { id, name: 'diary-2026-05-01.json', version }
}

function ok(body: unknown) { return { status: 200, body } }

test.beforeAll(async ({}, workerInfo) => {
  const port = 5400 + workerInfo.workerIndex
  server = await createServer({
    root: process.cwd(),
    server: { host: '127.0.0.1', port, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  baseUrl = server.resolvedUrls?.local[0] ?? ''
})

test.afterAll(async () => {
  await server.close()
})

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/useDiaryHarness.html`)
}

/**
 * Start the hook, providing the two initialization responses
 * (ensureFolder + listEntries) and wait until loading completes.
 */
async function startHarness(page: import('@playwright/test').Page, extraEntries = ENTRIES_EMPTY) {
  await page.evaluate(({ folder, entries }) => {
    window.diaryHarness.q({ status: 200, body: folder }, { status: 200, body: entries })
    window.diaryHarness.start()
  }, { folder: FOLDER_INIT, entries: extraEntries })

  await page.waitForSelector('#harness-ready')
}

test.describe('useDiary save — conflict detection', () => {
  test('first save uses findEntryMeta (list query) when no cache exists', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    await page.evaluate(() => window.diaryHarness.clearCalls())

    // Queue: findEntryMeta (null = new file), saveEntry (POST)
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },              // findEntryMeta → not found
        { status: 200, body: meta },                        // saveEntry POST → returns meta
      )
    }, { meta: fileMeta('1') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )

    expect(result).toMatchObject({ ok: true, result: { meta: { version: '1' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    // findEntryMeta uses the files list endpoint
    expect(calls[0].url).toContain('/drive/v3/files?q=')
    expect(calls[0].method).toBe('GET')
    // saveEntry uses POST multipart upload
    expect(calls[1].url).toContain('/upload/drive/v3/files?uploadType=multipart')
    expect(calls[1].method).toBe('POST')
  })

  test('second save uses getEntryMeta (direct file fetch) when cache exists', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save — seeds the cache
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },              // findEntryMeta
        { status: 200, body: meta },                        // saveEntry POST → version 1
      )
    }, { meta: fileMeta('1') })

    const first = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )
    expect(first).toMatchObject({ ok: true })

    // Second save — cache now has file-1 at version 1
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ getMeta, saveMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: getMeta },   // getEntryMeta → returns same version → no conflict
        { status: 200, body: saveMeta },  // saveEntry PATCH → version 2
      )
    }, { getMeta: fileMeta('1'), saveMeta: fileMeta('2') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello world', '1')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '2' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    // getEntryMeta uses direct file ID endpoint — NOT a list query
    expect(calls[0].url).toMatch(/\/drive\/v3\/files\/file-1\?fields=/)
    expect(calls[0].method).toBe('GET')
    // saveEntry uses PATCH
    expect(calls[1].url).toContain('/upload/drive/v3/files/file-1?uploadType=multipart')
    expect(calls[1].method).toBe('PATCH')
    expect(calls).toHaveLength(2)
  })

  test('no false conflict on consecutive saves when Drive list API would return stale version', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('5') })

    const first = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'draft', null)
    )
    expect(first).toMatchObject({ ok: true })

    // Second save: getEntryMeta returns version 5 (same as baseVersion) → no conflict.
    // If the old code path (findEntryMeta) were used and returned stale version 4,
    // it would falsely conflict. Here we return version 5 — simulating what
    // getEntryMeta (direct fetch) correctly returns.
    await page.evaluate(({ getMeta, saveMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: getMeta },
        { status: 200, body: saveMeta },
      )
    }, { getMeta: fileMeta('5'), saveMeta: fileMeta('6') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'draft with more text', '5')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '6' } } })
  })

  test('real conflict from another device is still detected', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save → version 2
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('2') })

    await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'my text', null)
    )

    // Another device updated the file → Drive now has version 3.
    // getEntryMeta returns 3, but our baseVersion is 2 → conflict.
    const remoteEntry = { date: '2026-05-01', content: 'remote text', updated_at: '2026-05-01T10:00:00Z' }
    await page.evaluate(({ getMeta, entry }) => {
      window.diaryHarness.q(
        { status: 200, body: getMeta },     // getEntryMeta → version 3
        { status: 200, body: entry },        // getEntry (to populate conflict remote)
      )
    }, { getMeta: fileMeta('3'), entry: remoteEntry })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'my local changes', '2')
    )

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(result).toMatchObject({ conflict: { meta: { version: '3' } } })
  })
})

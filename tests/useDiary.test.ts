import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

const FOLDER_INIT = { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] }
const ENTRIES_EMPTY = { files: [] }

function fileMeta(version: string, id = 'file-1') {
  return { id, name: 'diary-2026-05-01.json', version }
}

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/useDiaryHarness.html`)
}

async function startHarness(page: import('@playwright/test').Page, extraEntries = ENTRIES_EMPTY) {
  await page.evaluate(({ folder, entries }) => {
    window.diaryHarness.q({ status: 200, body: folder }, { status: 200, body: entries })
    window.diaryHarness.start()
  }, { folder: FOLDER_INIT, entries: extraEntries })
  await page.waitForSelector('#harness-ready')
}

test.describe('useDiary save — conflict detection', () => {
  test('first save of a new entry uses findEntryMeta (list query) and POST', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },  // findEntryMeta → not found
        { status: 200, body: meta },            // saveEntry POST
      )
    }, { meta: fileMeta('1') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )

    expect(result).toMatchObject({ ok: true, result: { meta: { version: '1' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls[0].url).toContain('/drive/v3/files?q=')
    expect(calls[1].url).toContain('/upload/drive/v3/files?uploadType=multipart')
    expect(calls[1].method).toBe('POST')
    expect(calls).toHaveLength(2)
  })

  test('second save skips Drive API entirely and uses PATCH directly', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save — seeds the cache with file-1 at version 1
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('1') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'hello', null))

    await page.evaluate(() => window.diaryHarness.clearCalls())

    // Second save: only saveEntry PATCH should be called — no Drive version check
    await page.evaluate(({ saveMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: saveMeta },  // saveEntry PATCH only
      )
    }, { saveMeta: fileMeta('2') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello world', '1')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '2' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls[0].url).toContain('/upload/drive/v3/files/file-1?uploadType=multipart')
    expect(calls[0].method).toBe('PATCH')
    expect(calls).toHaveLength(1)
  })

  test('no false conflict even if Drive API would have returned stale version', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save → version 5 in cache
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('5') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'draft', null))

    await page.evaluate(() => window.diaryHarness.clearCalls())

    // Second save: no Drive check — if we had called findEntryMeta it might have
    // returned stale version 4 and falsely conflicted
    await page.evaluate(({ saveMeta }) => {
      window.diaryHarness.q({ status: 200, body: saveMeta })
    }, { saveMeta: fileMeta('6') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'draft with more', '5')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '6' } } })
    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PATCH')
  })

  test('real conflict is detected when cached version differs from baseVersion', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save → cache has version 2
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [] } },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('2') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'my text', null))

    // Simulate: getContent ran (e.g. from App's recentPreviews effect) and updated
    // the cache with version 3 from another device
    const remoteEntry = { date: '2026-05-01', content: 'remote text', updated_at: '2026-05-01T10:00:00Z' }
    await page.evaluate(({ meta3, entry }) => {
      window.diaryHarness.q(
        { status: 200, body: meta3 },   // getEntryMeta (called by getContent)
        { status: 200, body: entry },    // getEntry (called by getContent)
      )
      // Simulate what getContent does: update cache with fresher version from Drive
      return window.diaryHarness.triggerGetContent('2026-05-01')
    }, { meta3: fileMeta('3'), entry: remoteEntry })

    // Now cache has version 3, but our baseVersion is still 2 → should conflict
    // getEntry is queued for conflict panel display
    await page.evaluate(({ entry }) => {
      window.diaryHarness.q({ status: 200, body: entry })
    }, { entry: remoteEntry })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'my local edits', '2')
    )

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(result).toMatchObject({ conflict: { meta: { version: '3' } } })
  })
})

test.describe('useDiary withFolderRetry — folder cache invalidation', () => {
  test('save 404 refetches folder and retries successfully with new folder id', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => {
      window.diaryHarness.resetFolderState()
    })

    // Queue: ensureFolder (re-fetch after reset), then the op sequence:
    // ensureFolder list → folder-1
    // findEntryMeta → 404 (simulates folder gone)
    // ensureFolder re-fetch after 404 → folder-2
    // findEntryMeta on folder-2 → not found
    // saveEntry → success
    await page.evaluate(({ fileMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } }, // ensureFolder
        { status: 404, body: { error: { message: 'File not found.' } } },                  // findEntryMeta → 404
        { status: 200, body: { files: [{ id: 'folder-2', name: 'GrassPuffer Diary' }] } }, // ensureFolder retry
        { status: 200, body: { files: [] } },                                               // findEntryMeta on folder-2
        { status: 200, body: fileMeta },                                                    // saveEntry
      )
    }, { fileMeta: fileMeta('1') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )

    expect(result).toMatchObject({ ok: true, result: { meta: { version: '1' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    // Verify folder-2 is used for the final save
    const saveCall = calls.find(c => c.url.includes('/upload/drive/v3/files?uploadType=multipart'))
    expect(saveCall).toBeDefined()
    expect(saveCall?.method).toBe('POST')
  })

  test('save 404 followed by folder refetch failure propagates original error', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => {
      window.diaryHarness.resetFolderState()
    })

    // Queue: ensureFolder → folder-1, op → 404, ensureFolder retry → also fails (500)
    await page.evaluate(() => {
      window.diaryHarness.q(
        { status: 200, body: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } }, // ensureFolder
        { status: 404, body: { error: { message: 'File not found.' } } },                  // findEntryMeta → 404
        // ensureFolder retry: 4 × 500 to exhaust withRetry's 3 retries
        { status: 500, body: 'err' },
        { status: 500, body: 'err' },
        { status: 500, body: 'err' },
        { status: 500, body: 'err' },
      )
    })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )

    if (result.ok) throw new Error('expected save to fail')
    expect(result.error).toContain('500')
  })
})

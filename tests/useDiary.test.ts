import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

const ENTRIES_EMPTY = { files: [] }

function fileMeta(version: string, id = 'file-1') {
  return { id, name: 'diary-2026-05-01.json', version }
}

function datedFileMeta(date: string, version = '1', id = `file-${date}`) {
  return { id, name: `diary-${date}.json`, version }
}

function entryResponse(version: string, content = 'hello', id = 'file-1') {
  return {
    entry: { date: '2026-05-01', content, updated_at: '2026-05-01T00:00:00.000Z' },
    meta: fileMeta(version, id),
  }
}

function datedEntryResponse(date: string, content: string, version = '1') {
  return {
    entry: { date, content, updated_at: '2026-05-01T00:00:00.000Z' },
    meta: datedFileMeta(date, version),
  }
}

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/useDiaryHarness.html`)
}

async function startHarness(page: import('@playwright/test').Page, extraEntries: { files: { id: string; name: string; version: string }[] } = ENTRIES_EMPTY) {
  await page.evaluate((entries) => {
    window.diaryHarness.q({ status: 200, body: entries })
    window.diaryHarness.start()
  }, extraEntries)
  await page.waitForSelector('#harness-ready')
}

test.describe('useDiary save — conflict detection', () => {
  test('first save of a new entry checks existence then POSTs', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 404, body: null },  // getEntryByDate → not found
        { status: 200, body: meta },  // saveEntry POST
      )
    }, { meta: fileMeta('1') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello', null)
    )

    expect(result).toMatchObject({ ok: true, result: { meta: { version: '1' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls[0].url).toBe('/api/drive/entry/2026-05-01')
    expect(calls[0].method).toBe('GET')
    expect(calls[1].url).toBe('/api/drive/entry/2026-05-01')
    expect(calls[1].method).toBe('POST')
    expect(calls).toHaveLength(2)
  })

  test('second save verifies the remote version before updating the cached file', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save — seeds the cache with file-1 at version 1
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 404, body: null },  // getEntryByDate → not found
        { status: 200, body: meta },  // saveEntry POST
      )
    }, { meta: fileMeta('1') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'hello', null))
    await page.evaluate(() => window.diaryHarness.clearCalls())

    // Second save: cached version matches baseVersion, then remote version is verified before PATCH
    await page.evaluate(({ remote, saveMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: remote },
        { status: 200, body: saveMeta },
      )
    }, { remote: entryResponse('1'), saveMeta: fileMeta('2') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'hello world', '1')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '2' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls[0].url).toBe('/api/drive/entry/2026-05-01?fileId=file-1')
    expect(calls[0].method).toBe('GET')
    expect(calls[1].url).toBe('/api/drive/entry/2026-05-01')
    expect(calls[1].method).toBe('POST')
    expect(calls).toHaveLength(2)
  })

  test('no false conflict when cached version matches baseVersion', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save → version 5 in cache
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 404, body: null },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('5') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'draft', null))
    await page.evaluate(() => window.diaryHarness.clearCalls())

    // Second save with matching baseVersion → remote check confirms no conflict, then PATCH
    await page.evaluate(({ remote, saveMeta }) => {
      window.diaryHarness.q(
        { status: 200, body: remote },
        { status: 200, body: saveMeta },
      )
    }, { remote: entryResponse('5'), saveMeta: fileMeta('6') })

    const second = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'draft with more', '5')
    )

    expect(second).toMatchObject({ ok: true, result: { meta: { version: '6' } } })
    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls).toHaveLength(2)
    expect(calls[0].method).toBe('GET')
    expect(calls[1].method).toBe('POST')
  })

  test('remote conflict is detected even when the local cache version still matches baseVersion', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page, { files: [fileMeta('1')] })
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ remote }) => {
      window.diaryHarness.q({ status: 200, body: remote })
    }, { remote: entryResponse('2', 'remote changed text') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'my local edits', '1')
    )

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(result).toMatchObject({ conflict: { meta: { version: '2' } } })

    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
  })

  test('real conflict is detected when cached version differs from baseVersion', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    // First save → cache has version 2
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 404, body: null },
        { status: 200, body: meta },
      )
    }, { meta: fileMeta('2') })

    await page.evaluate(() => window.diaryHarness.save('2026-05-01', 'my text', null))

    // Simulate: getContent ran and updated cache to version 3
    await page.evaluate(({ entry3 }) => {
      window.diaryHarness.q(
        { status: 200, body: entry3 },  // getEntryByDate (called by getContent)
      )
      return window.diaryHarness.triggerGetContent('2026-05-01')
    }, { entry3: entryResponse('3', 'remote text') })

    // Now cache has version 3, but our baseVersion is 2 → conflict
    // getEntryByDate is called to get the remote entry for conflict display
    await page.evaluate(({ entry3 }) => {
      window.diaryHarness.q({ status: 200, body: entry3 })
    }, { entry3: entryResponse('3', 'remote text') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'my local edits', '2')
    )

    expect(result).toMatchObject({ ok: false, error: 'conflict' })
    expect(result).toMatchObject({ conflict: { meta: { version: '3' } } })
  })
})

test.describe('useDiary getContent — session expiry', () => {
  test('calls onExpired and re-throws TokenExpiredError when /api returns 401', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)

    await page.evaluate(() => {
      window.diaryHarness.q({ status: 401, body: {} })
    })

    const result = await page.evaluate(async () => {
      try {
        await window.diaryHarness.triggerGetContent('2026-05-01')
        return { threw: false, message: null }
      } catch (e) {
        return { threw: true, message: e instanceof Error ? e.message : String(e) }
      }
    })

    expect(result.threw).toBe(true)
    expect(result.message).toBe('Session expired')

    const expired = await page.evaluate(() => window.diaryHarness.expiredCalls())
    expect(expired).toBe(1)
  })
})

test.describe('useDiary Drive read batching', () => {
  test('search loads uncached matching entries with bounded parallel requests', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => window.diaryHarness.clearCalls())

    const dates = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05']
    await page.evaluate(({ files, entries }) => {
      window.diaryHarness.q(
        { status: 200, body: { files } },
        ...entries.map(entry => ({ status: 200, body: entry, delayMs: 200 })),
      )
      ;(window as any).__searchResult = null
      void window.diaryHarness.search('needle').then(result => {
        ;(window as any).__searchResult = result
      })
    }, {
      files: dates.map(date => datedFileMeta(date)),
      entries: dates.map(date => datedEntryResponse(date, `text with needle ${date}`)),
    })

    await expect.poll(async () => (await page.evaluate(() => window.diaryHarness.calls())).length).toBe(6)
    await expect.poll(async () => page.evaluate(() => (window as any).__searchResult?.results.length ?? 0)).toBe(5)
  })

  test('exportAll reads entries with bounded parallel requests and preserves sorted output', async ({ page }) => {
    await loadHarness(page)
    const dates = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06']
    await startHarness(page, { files: dates.map(date => datedFileMeta(date)) })
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ entries }) => {
      window.diaryHarness.q(
        ...entries.map(entry => ({ status: 200, body: entry, delayMs: 200 })),
      )
      ;(window as any).__exportResult = null
      void window.diaryHarness.exportAll().then(result => {
        ;(window as any).__exportResult = result
      })
    }, {
      entries: dates.map(date => datedEntryResponse(date, `content ${date}`)),
    })

    await expect.poll(async () => (await page.evaluate(() => window.diaryHarness.calls())).length).toBe(4)
    await expect.poll(async () => page.evaluate(() => (window as any).__exportResult?.length ?? 0)).toBe(6)

    const resultDates = await page.evaluate(() => (window as any).__exportResult.map((entry: { date: string }) => entry.date))
    expect(resultDates).toEqual(dates)
    expect(await page.evaluate(() => window.diaryHarness.progressCalls())).toHaveLength(6)
  })
})

test.describe('useDiary refreshEntries', () => {
  test('refreshes the entry list from Drive without requiring a remount', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page, { files: [datedFileMeta('2026-05-01')] })
    await expect(page.locator('#harness-ready')).toHaveAttribute('data-dates', '2026-05-01')
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate((files) => {
      window.diaryHarness.q({
        status: 200,
        body: { files },
      })
      return window.diaryHarness.refreshEntries()
    }, [datedFileMeta('2026-05-03'), datedFileMeta('2026-05-02')])

    await expect(page.locator('#harness-ready')).toHaveAttribute('data-dates', '2026-05-03,2026-05-02')
    const calls = await page.evaluate(() => window.diaryHarness.calls())
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/api/drive/entries')
  })
})

test.describe('useDiary save — entry not found at save time', () => {
  test('save with no cache creates entry via POST with no fileId', async ({ page }) => {
    await loadHarness(page)
    await startHarness(page)
    await page.evaluate(() => window.diaryHarness.clearCalls())

    await page.evaluate(({ meta }) => {
      window.diaryHarness.q(
        { status: 404, body: null },  // getEntryByDate → not found (no conflict)
        { status: 200, body: meta },  // saveEntry POST
      )
    }, { meta: fileMeta('1') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'new entry', null)
    )

    expect(result).toMatchObject({ ok: true, result: { meta: { version: '1' } } })
  })

  test('force save overwrites even when versions differ', async ({ page }) => {
    await loadHarness(page)
    // Start with an entry in the list
    await startHarness(page, { files: [fileMeta('5')] })
    await page.evaluate(() => window.diaryHarness.clearCalls())

    // save with force=true, version mismatch should not conflict
    await page.evaluate(({ meta }) => {
      window.diaryHarness.q({ status: 200, body: meta })
    }, { meta: fileMeta('6') })

    const result = await page.evaluate(() =>
      window.diaryHarness.save('2026-05-01', 'forced content', '3', true)
    )

    expect(result).toMatchObject({ ok: true })
    const calls = await page.evaluate(() => window.diaryHarness.calls())
    // Force with existing cache should go straight to save
    expect(calls[0].method).toBe('POST')
    expect(calls).toHaveLength(1)
  })
})

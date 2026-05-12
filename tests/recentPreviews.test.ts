import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('recent entry previews', () => {
  const today = '2026-05-09'
  const recentDates = ['2026-05-09', '2026-05-08', '2026-05-07', '2026-05-06', '2026-05-05']

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('grass_puffer_language', 'en')
      const RealDate = Date
      const fixedNow = new RealDate('2026-05-09T12:00:00+09:00').getTime()
      class MockDate extends RealDate {
        constructor(...args: Parameters<DateConstructor>) {
          if (args.length === 0) super(fixedNow)
          else super(...args)
        }
        static now() { return fixedNow }
      }
      Object.defineProperty(window, 'Date', { configurable: true, value: MockDate })
    })
  })

  test('previews are fetched on initial load but not on date navigation', async ({ page }) => {
    const requestLog: string[] = []

    await page.route('/auth/session', async route => {
      await route.fulfill({ json: { signedIn: true } })
    })

    await page.route('/api/drive/entries', async route => {
      await route.fulfill({
        json: {
          files: recentDates.map((d, i) => ({
            id: `file-${d}`,
            name: `diary-${d}.json`,
            version: String(10 - i),
          })),
        },
      })
    })

    await page.route('/api/drive/entry/**', async route => {
      const date = new URL(route.request().url()).pathname.split('/').pop()!
      requestLog.push(date)
      if (date === today) {
        await route.fulfill({ status: 404, body: '' })
      } else {
        await route.fulfill({
          json: {
            entry: { date, content: `entry for ${date}`, updated_at: `${date}T00:00:00.000Z` },
            meta: { id: `file-${date}`, name: `diary-${date}.json`, version: '10' },
          },
        })
      }
    })

    await page.goto(baseUrl)
    await expect(page.locator('.editor-textarea')).toBeVisible()
    await page.waitForTimeout(500)

    // Verify preview dates were fetched on initial load
    const previewDates = recentDates.filter(d => d !== today)
    for (const d of previewDates) {
      expect(requestLog).toContain(d)
    }

    const beforeNavCount = requestLog.length

    // Navigate to the previous day
    await page.locator('[aria-label="Previous day"]').click()
    await expect(page).toHaveURL(/#2026-05-08/)
    await page.waitForTimeout(300)

    // Only the navigated-to date should have been fetched
    const newFetches = requestLog.slice(beforeNavCount)
    const expectedDate = '2026-05-08'
    expect(newFetches).toContain(expectedDate)
    // Other preview dates should NOT be re-fetched
    for (const d of previewDates.filter(d => d !== expectedDate)) {
      expect(newFetches.filter(f => f === d)).toHaveLength(0)
    }
  })
})

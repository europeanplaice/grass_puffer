import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('recent entry previews', () => {
  const today = '2026-05-09'
  const recentDates = ['2026-05-09', '2026-05-08', '2026-05-07', '2026-05-06', '2026-05-05']

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('linger_language', 'en')
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

  test('snippet updates immediately after saving a new entry', async ({ page }) => {
    // Today's file is listed (so it appears in recent) but its content returns 404 (no text yet)
    const entryContent: Map<string, string> = new Map(
      recentDates.filter(d => d !== today).map(d => [d, `entry for ${d}`]),
    )

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
      const url = new URL(route.request().url())
      const date = url.pathname.split('/').pop()!
      const method = route.request().method()

      if (method === 'POST') {
        const body = route.request().postDataJSON()
        entryContent.set(date, body.content)
        await route.fulfill({
          json: {
            id: `file-${date}`,
            name: `diary-${date}.json`,
            version: '1',
          },
        })
        return
      }

      const content = entryContent.get(date)
      if (!content) {
        await route.fulfill({ status: 404, body: '' })
      } else {
        await route.fulfill({
          json: {
            entry: { date, content, updated_at: `${date}T00:00:00.000Z` },
            meta: { id: `file-${date}`, name: `diary-${date}.json`, version: '10' },
          },
        })
      }
    })

    await page.goto(baseUrl)
    await expect(page.locator('textarea.editor-textarea')).toBeVisible()
    await page.waitForTimeout(500)

    // Today is selected and has no entry yet — snippet shows "No text yet"
    await expect(
      page.locator('.entry-list li.today .entry-list-preview'),
    ).toHaveText('No text yet')

    await page.locator('textarea.editor-textarea').fill('My first entry')
    await page.locator('button.btn-save').click()
    await expect(page.locator('button.btn-save')).toHaveAttribute('aria-label', 'Saved')

    // After save, snippet should reflect the typed content, not "No text yet"
    await expect(
      page.locator('.entry-list li.today .entry-list-preview'),
    ).toHaveText('My first entry')
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

    // Wait for preview content to appear in the first non-today entry
    await expect(
      page.locator('.entry-list li:not(.today) .entry-list-preview').first()
    ).toHaveText(/entry for/)

    // Verify preview dates were fetched on initial load
    const previewDates = recentDates.filter(d => d !== today)
    for (const d of previewDates) {
      expect(requestLog).toContain(d)
    }

    const beforeNavCount = requestLog.length

    // Navigate to the previous day
    await page.locator('[aria-label="Previous day"]').click()
    await expect(page).toHaveURL(/#2026-05-08/)
    // During the slide animation both old and new textareas coexist briefly; .last() is the incoming entry
    await expect(page.locator('.editor-textarea').last()).toHaveValue(/entry for 2026-05-08/)

    // Preview content is cached in memory, so navigation should reuse it instead of
    // re-fetching the entry or any other preview date.
    const newFetches = requestLog.slice(beforeNavCount)
    for (const d of previewDates) {
      expect(newFetches.filter(f => f === d)).toHaveLength(0)
    }
  })
})

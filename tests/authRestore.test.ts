import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('grass_puffer_language', 'en')
  })
})

test('valid session skips login screen and shows diary directly', async ({ page }) => {
  await page.route('/auth/session', async route => {
    await route.fulfill({ json: { signedIn: true } })
  })
  await page.route('/api/drive/entries', async route => {
    await route.fulfill({ json: { files: [] } })
  })
  await page.route('/api/drive/entry/**', async route => {
    await route.fulfill({ status: 404, body: '' })
  })

  await page.goto(baseUrl)

  await expect(page.locator('.editor-textarea')).toBeVisible()
  await expect(page.locator('.login-screen')).toHaveCount(0)
})

test('no session shows login screen with sign-in button', async ({ page }) => {
  await page.route('/auth/session', async route => {
    await route.fulfill({ json: { signedIn: false } })
  })

  await page.goto(baseUrl)

  await expect(page.locator('.login-screen')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.locator('.editor-textarea')).toHaveCount(0)
})

test('clicking app title navigates to today without triggering a new sign-in', async ({ page }) => {
  await page.route('/auth/session', async route => {
    await route.fulfill({ json: { signedIn: true } })
  })
  await page.route('/api/drive/entries', async route => {
    await route.fulfill({ json: { files: [] } })
  })
  await page.route('/api/drive/entry/**', async route => {
    await route.fulfill({ status: 404, body: '' })
  })

  await page.goto(baseUrl)
  await expect(page.locator('.editor-textarea')).toBeVisible()

  const today = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // Navigate to a different date
  const otherDate = today === '2026-05-01' ? '2026-05-02' : '2026-05-01'
  await page.evaluate((d) => { window.location.hash = d }, otherDate)
  await page.waitForSelector('.entry-date-text:not([data-today])')

  // Click the app title
  await page.locator('.app-title').click()

  // Should navigate to today
  await expect(page).toHaveURL(new RegExp(`#${today}`))
  await expect(page.locator('.entry-date-text')).toHaveAttribute('data-today', 'true')
})

test('prioritizes visible entry load before loading other entries', async ({ page }) => {
  await page.addInitScript(() => {
    const RealDate = Date
    const fixedNow = new RealDate('2026-05-01T12:00:00+09:00').getTime()
    class MockDate extends RealDate {
      constructor(...args: []) {
        if (args.length === 0) {
          super(fixedNow)
        } else {
          super(...args)
        }
      }
      static now() { return fixedNow }
    }
    Object.defineProperty(window, 'Date', { configurable: true, value: MockDate })
  })

  const selectedDate = '2026-05-01'
  const olderDate = '2026-04-30'
  const requestLog: string[] = []
  let releaseSelectedEntry!: () => void
  const selectedEntryGate = new Promise<void>(resolve => { releaseSelectedEntry = resolve })

  await page.route('/auth/session', async route => {
    await route.fulfill({ json: { signedIn: true } })
  })

  await page.route('/api/drive/entries', async route => {
    await route.fulfill({
      json: {
        files: [
          { id: 'file-selected', name: `diary-${selectedDate}.json`, version: '11' },
          { id: 'file-older', name: `diary-${olderDate}.json`, version: '10' },
        ],
      },
    })
  })

  await page.route(`/api/drive/entry/${selectedDate}`, async route => {
    requestLog.push('selected')
    await selectedEntryGate
    await route.fulfill({
      json: {
        entry: { date: selectedDate, content: 'selected entry content', updated_at: '2026-05-01T00:00:00.000Z' },
        meta: { id: 'file-selected', name: `diary-${selectedDate}.json`, version: '11' },
      },
    })
  })

  await page.route(`/api/drive/entry/${olderDate}`, async route => {
    requestLog.push('older')
    await route.fulfill({
      json: {
        entry: { date: olderDate, content: 'older entry content', updated_at: '2026-04-30T00:00:00.000Z' },
        meta: { id: 'file-older', name: `diary-${olderDate}.json`, version: '10' },
      },
    })
  })

  await page.goto(baseUrl)

  await expect.poll(() => requestLog).toContain('selected')
  await page.waitForTimeout(150)
  // older entry should not have been fetched yet while selected is loading
  expect(requestLog.filter(r => r === 'older')).toHaveLength(0)

  releaseSelectedEntry()
  await expect(page.locator('.editor-textarea')).toHaveValue('selected entry content')
})

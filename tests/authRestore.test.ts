import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

function installGoogleMock(options: boolean | { restorable: boolean; failFirst?: boolean }) {
  const restorable = typeof options === 'boolean' ? options : options.restorable
  const failFirst = typeof options === 'boolean' ? false : Boolean(options.failFirst)

  window.localStorage.clear()
  window.localStorage.setItem('grass_puffer_language', 'en')
  if (restorable) window.localStorage.setItem('grass-puffer-auth-restorable', '1')

  Object.defineProperty(window, 'google', {
    configurable: true,
    value: {
      accounts: {
        oauth2: {
          initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => {
            let requestCount = 0
            ;(window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady = true
            ;(window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount = 0
            return {
              requestAccessToken: (tokenConfig?: google.accounts.oauth2.OverridableTokenClientConfig) => {
                const state = window as unknown as { __tokenRequestCount: number }
                state.__tokenRequestCount += 1
                ;(window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }).__lastTokenRequestConfig = tokenConfig
                if (failFirst && requestCount === 0) {
                  requestCount++
                  // Simulate a failed token request (no active session)
                  config.callback?.({ error: 'access_denied', state: tokenConfig?.state } as google.accounts.oauth2.TokenResponse)
                } else {
                  requestCount++
                  config.callback?.({ access_token: 'test-token', state: tokenConfig?.state } as google.accounts.oauth2.TokenResponse)
                }
              },
            }
          },
          revoke: () => {},
        },
      },
    },
  })
}

function installExpiringGoogleMock() {
  window.localStorage.clear()
  window.localStorage.setItem('grass_puffer_language', 'en')
  window.localStorage.setItem('grass_puffer_autosave', 'false')

  Object.defineProperty(window, 'google', {
    configurable: true,
    value: {
      accounts: {
        oauth2: {
          initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => {
            ;(window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady = true
            ;(window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount = 0
            return {
              requestAccessToken: (tokenConfig?: google.accounts.oauth2.OverridableTokenClientConfig) => {
                const state = window as unknown as { __tokenRequestCount: number }
                state.__tokenRequestCount += 1
                ;(window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }).__lastTokenRequestConfig = tokenConfig
                config.callback?.({ access_token: `test-token-${state.__tokenRequestCount}`, state: tokenConfig?.state } as google.accounts.oauth2.TokenResponse)
              },
            }
          },
          revoke: () => {},
        },
      },
    },
  })
}

test.beforeEach(async ({ page }) => {
  await page.route('https://accounts.google.com/gsi/client', async route => {
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await page.route('https://www.googleapis.com/drive/v3/files**', async route => {
    const url = decodeURIComponent(route.request().url())
    if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
      await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
      return
    }
    await route.fulfill({ json: { files: [] } })
  })
})

test('previous session offers user-initiated restore after page load', async ({ page }) => {
  await page.addInitScript(installGoogleMock, true)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(0)

  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(1)
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }
  ).__lastTokenRequestConfig)).toEqual(expect.objectContaining({ prompt: '' }))
  await expect(page.locator('.editor-textarea')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})

test('first-time visitors still see the normal Google sign-in action', async ({ page }) => {
  await page.addInitScript(installGoogleMock, false)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})

test('prioritizes the visible entry load before recent preview content after sign-in', async ({ page }) => {
  await page.addInitScript(installGoogleMock, false)
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

      static now() {
        return fixedNow
      }
    }
    Object.defineProperty(window, 'Date', { configurable: true, value: MockDate })
  })

  const selectedDate = '2026-05-01'
  const olderDate = '2026-04-30'
  const requestLog: string[] = []
  let releaseSelectedMedia!: () => void
  const selectedMediaGate = new Promise<void>(resolve => {
    releaseSelectedMedia = resolve
  })

  await page.route('https://www.googleapis.com/drive/v3/files**', async route => {
    const url = decodeURIComponent(route.request().url())

    if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
      await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
      return
    }

    if (url.includes(`name='diary-${selectedDate}.json'`)) {
      await route.fulfill({
        json: {
          files: [
            { id: 'file-selected', name: `diary-${selectedDate}.json`, version: '11', modifiedTime: '2026-05-01T00:00:00.000Z' },
          ],
        },
      })
      return
    }

    if (url.includes("'folder-1' in parents") && url.includes("mimeType='application/json'") && !url.includes("name='diary-")) {
      await route.fulfill({
        json: {
          files: [
            { id: 'file-selected', name: `diary-${selectedDate}.json`, version: '11', modifiedTime: '2026-05-01T00:00:00.000Z' },
            { id: 'file-older', name: `diary-${olderDate}.json`, version: '10', modifiedTime: '2026-04-30T00:00:00.000Z' },
          ],
        },
      })
      return
    }

    if (url.includes('/files/file-selected?alt=media')) {
      requestLog.push('selected:media')
      await selectedMediaGate
      await route.fulfill({
        json: { date: selectedDate, content: 'selected entry content', updated_at: '2026-05-01T00:00:00.000Z' },
      })
      return
    }

    if (url.includes('/files/file-older')) {
      requestLog.push('older:content')
      await route.fulfill({
        json: url.includes('alt=media')
          ? { date: olderDate, content: 'older entry content', updated_at: '2026-04-30T00:00:00.000Z' }
          : { id: 'file-older', name: `diary-${olderDate}.json`, version: '10', modifiedTime: '2026-04-30T00:00:00.000Z' },
      })
      return
    }

    if (url.includes('/files/file-selected')) {
      requestLog.push('selected:meta')
      await route.fulfill({
        json: { id: 'file-selected', name: `diary-${selectedDate}.json`, version: '11', modifiedTime: '2026-05-01T00:00:00.000Z' },
      })
      return
    }

    await route.fulfill({ json: { files: [] } })
  })

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()

  await expect.poll(() => requestLog).toContain('selected:media')
  await page.waitForTimeout(150)
  expect(requestLog.every(item => item.startsWith('selected:'))).toBe(true)

  releaseSelectedMedia()
  await expect(page.locator('.editor-textarea')).toHaveValue('selected entry content')
  await expect.poll(() => requestLog).toContain('older:content')
})

test('previous session can be forgotten before signing in fresh', async ({ page }) => {
  await page.addInitScript(installGoogleMock, true)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(0)

  await page.getByRole('button', { name: 'Use another account' }).click()

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  await expect(page.evaluate(() => localStorage.getItem('grass-puffer-auth-restorable'))).resolves.toBeNull()

  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(1)
  await expect(page.locator('.editor-textarea')).toBeVisible()
})

test('expired save reauth retries with the refreshed token without showing re-login failed', async ({ page }) => {
  await page.addInitScript(installExpiringGoogleMock)

  const uploadTokens: string[] = []

  await page.route('https://www.googleapis.com/upload/drive/v3/files**', async route => {
    const token = route.request().headers().authorization ?? ''
    if (token === 'Bearer test-token-1') {
      await route.fulfill({ status: 401, body: 'expired' })
      return
    }
    uploadTokens.push(token)
    await route.fulfill({
      json: {
        id: 'file-1',
        name: 'diary-2026-05-02.json',
        version: '1',
        modifiedTime: '2026-05-02T00:00:00.000Z',
      },
    })
  })

  await page.route('https://www.googleapis.com/drive/v3/files**', async route => {
    const request = route.request()
    const url = decodeURIComponent(request.url())

    if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
      await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
      return
    }

    if (url.includes("'folder-1' in parents") && url.includes("name='diary-")) {
      await route.fulfill({ json: { files: [] } })
      return
    }

    if (url.includes("'folder-1' in parents")) {
      await route.fulfill({ json: { files: [] } })
      return
    }

    await route.fulfill({ json: {} })
  })

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.locator('.editor-textarea')).toBeVisible()

  await page.locator('.editor-textarea').fill('saved after refreshed token')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Your session has expired. Please log in again.')).toBeVisible()
  await page.getByRole('button', { name: 'Log in again' }).click()

  await expect(page.getByText('Re-login failed. Please try again.')).toHaveCount(0)
  await expect(page.getByText('Your session has expired. Please log in again.')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }
  ).__lastTokenRequestConfig)).toEqual(expect.objectContaining({ prompt: '' }))
  await expect.poll(() => uploadTokens).toEqual(['Bearer test-token-2'])
  await expect(page.locator('.editor-textarea')).toHaveValue('saved after refreshed token')
  await expect(page.locator('.btn-save')).toBeDisabled()
})

test('clicking app title navigates to today without requesting a new token', async ({ page }) => {
  await page.addInitScript(installGoogleMock, false)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await page.getByRole('button', { name: 'Sign in with Google' }).click()
  await expect(page.locator('.editor-textarea')).toBeVisible()

  const today = await page.evaluate(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })

  // Navigate to a different date (not today) via hash
  const otherDate = today === '2026-05-01' ? '2026-05-02' : '2026-05-01'
  await page.evaluate((d) => { window.location.hash = d }, otherDate)
  await page.waitForSelector(`.entry-date-text:not([data-today])`)

  // Click the app title
  await page.locator('.app-title').click()

  // Should navigate to today - check URL hash and data-today attribute
  await expect(page).toHaveURL(new RegExp(`#${today}`))
  await expect(page.locator('.entry-date-text')).toHaveAttribute('data-today', 'true')

  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(1)
})

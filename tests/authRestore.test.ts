import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

function installGoogleMock(restorable: boolean) {
  window.localStorage.clear()
  if (restorable) window.localStorage.setItem('grass-puffer-auth-restorable', '1')

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
                config.callback?.({ access_token: 'test-token', state: tokenConfig?.state } as google.accounts.oauth2.TokenResponse)
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

test('previous session shows one-click restore without requesting a token on page load', async ({ page }) => {
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
})

test('first-time visitors still see the normal Google sign-in action', async ({ page }) => {
  await page.addInitScript(installGoogleMock, false)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})

test('previous session can be forgotten before requesting a token', async ({ page }) => {
  await page.addInitScript(installGoogleMock, true)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
  await page.getByRole('button', { name: 'Use another account' }).click()

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('grass-puffer-auth-restorable'))).toBeNull()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tokenRequestCount?: number }).__tokenRequestCount)).toBe(0)
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
})

test('clicking app title navigates to today and refreshes token silently', async ({ page }) => {
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

  // Should have triggered a silent token refresh (prompt: '')
  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __lastTokenRequestConfig?: google.accounts.oauth2.OverridableTokenClientConfig }
  ).__lastTokenRequestConfig)).toEqual(expect.objectContaining({ prompt: '' }))
})

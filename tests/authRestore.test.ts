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
                config.callback?.({ access_token: 'test-token' } as google.accounts.oauth2.TokenResponse)
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
  ).__lastTokenRequestConfig)).toEqual({ prompt: '' })
  await expect(page.locator('.editor-textarea')).toBeVisible()
})

test('first-time visitors still see the normal Google sign-in action', async ({ page }) => {
  await page.addInitScript(installGoogleMock, false)

  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0)
})

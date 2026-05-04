import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/loginScreenHarness.html`)
}

async function render(
  page: import('@playwright/test').Page,
  opts: { authReady?: boolean; wasPreviouslySignedIn?: boolean; sessionExpired?: boolean; loadFailed?: boolean } = {},
) {
  await page.evaluate((opts) => {
    window.loginScreenHarness.render(opts)
  }, opts)
  await page.waitForSelector('.login-screen')
}

test.describe('LoginScreen — footer links', () => {
  test('shows Privacy Policy and Terms of Service links', async ({ page }) => {
    await loadHarness(page)
    await render(page)

    const privacyLink = page.locator('.login-footer a[href="/privacy.html"]')
    const tosLink = page.locator('.login-footer a[href="/terms-of-service.html"]')

    await expect(privacyLink).toBeVisible()
    await expect(privacyLink).toHaveText('Privacy Policy')

    await expect(tosLink).toBeVisible()
    await expect(tosLink).toHaveText('Terms of Service')
  })

  test('links open in new tab with noopener noreferrer', async ({ page }) => {
    await loadHarness(page)
    await render(page)

    const privacyLink = page.locator('.login-footer a[href="/privacy.html"]')
    const tosLink = page.locator('.login-footer a[href="/terms-of-service.html"]')

    await expect(privacyLink).toHaveAttribute('target', '_blank')
    await expect(privacyLink).toHaveAttribute('rel', 'noopener noreferrer')

    await expect(tosLink).toHaveAttribute('target', '_blank')
    await expect(tosLink).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

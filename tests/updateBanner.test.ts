import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('update banner', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('grass_puffer_language', 'en')
    })
    await page.route('/auth/session', route => route.fulfill({ json: { signedIn: true } }))
    await page.route('/api/drive/entries', route => route.fulfill({ json: { files: [] } }))
  })

  test('shows banner when preview=update-banner param is set', async ({ page }) => {
    await page.goto(`${baseUrl}?preview=update-banner`)
    await expect(page.locator('.update-banner')).toBeVisible()
    await expect(page.locator('.update-banner')).toContainText('A new version is available')
  })

  test('has a visible reload button', async ({ page }) => {
    await page.goto(`${baseUrl}?preview=update-banner`)
    await expect(page.locator('.update-banner-reload')).toBeVisible()
    await expect(page.locator('.update-banner-reload')).toContainText('Reload')
  })

  test('does not show banner without the preview param', async ({ page }) => {
    await page.goto(baseUrl)
    await expect(page.locator('.sidebar-empty-hint')).toBeVisible()
    await expect(page.locator('.update-banner')).toHaveCount(0)
  })
})

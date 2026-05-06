import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('i18n', () => {
  test('defaults to Japanese when no language is stored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('grass_puffer_language')
    })

    await page.goto(`${baseUrl}/tests/loginScreenHarness.html`)
    await page.evaluate(() => {
      window.loginScreenHarness.render()
    })

    await expect(page.getByRole('button', { name: 'Google でログイン' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
    await expect(page).toHaveTitle('Grass Puffer 日記')
  })

  test('switches between Japanese and English from settings and persists the choice', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('grass_puffer_language')
    })

    await page.goto(`${baseUrl}/tests/settingsModalHarness.html`)
    await page.evaluate(() => {
      window.settingsHarness.render({ modalOpen: true })
    })

    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible()

    await page.getByLabel('言語').selectOption('en')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('grass_puffer_language'))).toBe('en')
  })
})

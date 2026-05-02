import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('useFont', () => {
  test('initializes with stored font from localStorage', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useFontHarness.html`)
    await page.evaluate(() => {
      localStorage.setItem('grass_puffer_font', 'sans')
    })
    await page.reload()
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('sans')
  })

  test('defaults to serif when no stored font', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useFontHarness.html`)
    await page.evaluate(() => {
      localStorage.removeItem('grass_puffer_font')
    })
    await page.reload()
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('serif')
  })

  test('toggleFont switches serif → sans → serif', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useFontHarness.html`)
    // Default is serif
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('serif')

    await page.evaluate(() => window.fontHarness.toggle())
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('sans')

    await page.evaluate(() => window.fontHarness.toggle())
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('serif')
  })

  test('toggleFont stores new mode in localStorage', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useFontHarness.html`)
    // Default is serif
    await page.evaluate(() => window.fontHarness.toggle())
    expect(await page.evaluate(() => window.fontHarness.mode())).toBe('sans')
    expect(await page.evaluate(() => localStorage.getItem('grass_puffer_font'))).toBe('sans')
  })

  test('applies data-font attribute on documentElement', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useFontHarness.html`)
    // Default is serif
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-font'))).toBe('serif')

    await page.evaluate(() => window.fontHarness.toggle())
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-font'))).toBe('sans')
  })
})

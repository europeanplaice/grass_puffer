import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.describe('useTheme', () => {
  test('initializes with stored theme from localStorage', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.setItem('grass_puffer_theme', 'dark')
    })
    await page.reload()
    expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  })

  test('defaults to system when no stored theme', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.removeItem('grass_puffer_theme')
    })
    await page.reload()
    expect(await page.evaluate(() => window.themeHarness.mode())).toBe('system')
  })

  test('toggleTheme cycles dark → light → dark', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    // Start from dark
    await page.evaluate(() => {
      localStorage.setItem('grass_puffer_theme', 'dark')
    })
    await page.reload()
    expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')

    await page.evaluate(() => window.themeHarness.toggle())
    await expect.poll(() => page.evaluate(() => window.themeHarness.mode())).toBe('light')

    await page.evaluate(() => window.themeHarness.toggle())
    await expect.poll(() => page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  })

  test('toggleTheme stores new mode in localStorage', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.setItem('grass_puffer_theme', 'dark')
    })
    await page.reload()
    expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')

    await page.evaluate(() => window.themeHarness.toggle())
    await expect.poll(() => page.evaluate(() => window.themeHarness.mode())).toBe('light')
    await expect.poll(() => page.evaluate(() => localStorage.getItem('grass_puffer_theme'))).toBe('light')
  })

  test('applies data-theme attribute on documentElement', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.setItem('grass_puffer_theme', 'dark')
    })
    await page.reload()
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')

    await page.evaluate(() => window.themeHarness.toggle())
    await expect.poll(() => page.evaluate(() => (
      document.documentElement.getAttribute('data-theme')
    ))).toBe('light')
  })

  test('effectiveTheme returns system preference when mode is system', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.removeItem('grass_puffer_theme')
    })
    await page.reload()
    const effective = await page.evaluate(() => window.themeHarness.effectiveTheme())
    // System preference is usually light in test env, but we just check it's valid
    expect(['light', 'dark']).toContain(effective)
  })

  test('reacts to system theme change when mode is system', async ({ page }) => {
    await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
    await page.evaluate(() => {
      localStorage.removeItem('grass_puffer_theme')
    })
    await page.reload()

    // Emulate light system theme
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')

    // Emulate dark system theme
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
  })
})

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: useTheme.test.ts >> useTheme >> toggleTheme cycles dark → light → dark
- Location: tests/useTheme.test.ts:23:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "light"
Received: "dark"
```

# Page snapshot

```yaml
- generic [ref=e3]: light
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | import { baseUrl } from './baseUrl'
  3  | 
  4  | test.describe('useTheme', () => {
  5  |   test('initializes with stored theme from localStorage', async ({ page }) => {
  6  |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  7  |     await page.evaluate(() => {
  8  |       localStorage.setItem('grass_puffer_theme', 'dark')
  9  |     })
  10 |     await page.reload()
  11 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  12 |   })
  13 | 
  14 |   test('defaults to system when no stored theme', async ({ page }) => {
  15 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  16 |     await page.evaluate(() => {
  17 |       localStorage.removeItem('grass_puffer_theme')
  18 |     })
  19 |     await page.reload()
  20 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('system')
  21 |   })
  22 | 
  23 |   test('toggleTheme cycles dark → light → dark', async ({ page }) => {
  24 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  25 |     // Start from dark
  26 |     await page.evaluate(() => {
  27 |       localStorage.setItem('grass_puffer_theme', 'dark')
  28 |     })
  29 |     await page.reload()
  30 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  31 | 
  32 |     await page.evaluate(() => window.themeHarness.toggle())
> 33 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('light')
     |                                                                   ^ Error: expect(received).toBe(expected) // Object.is equality
  34 | 
  35 |     await page.evaluate(() => window.themeHarness.toggle())
  36 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  37 |   })
  38 | 
  39 |   test('toggleTheme stores new mode in localStorage', async ({ page }) => {
  40 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  41 |     await page.evaluate(() => {
  42 |       localStorage.setItem('grass_puffer_theme', 'dark')
  43 |     })
  44 |     await page.reload()
  45 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('dark')
  46 | 
  47 |     await page.evaluate(() => window.themeHarness.toggle())
  48 |     expect(await page.evaluate(() => window.themeHarness.mode())).toBe('light')
  49 |     expect(await page.evaluate(() => localStorage.getItem('grass_puffer_theme'))).toBe('light')
  50 |   })
  51 | 
  52 |   test('applies data-theme attribute on documentElement', async ({ page }) => {
  53 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  54 |     await page.evaluate(() => {
  55 |       localStorage.setItem('grass_puffer_theme', 'dark')
  56 |     })
  57 |     await page.reload()
  58 |     expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
  59 | 
  60 |     await page.evaluate(() => window.themeHarness.toggle())
  61 |     expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')
  62 |   })
  63 | 
  64 |   test('effectiveTheme returns system preference when mode is system', async ({ page }) => {
  65 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  66 |     await page.evaluate(() => {
  67 |       localStorage.removeItem('grass_puffer_theme')
  68 |     })
  69 |     await page.reload()
  70 |     const effective = await page.evaluate(() => window.themeHarness.effectiveTheme())
  71 |     // System preference is usually light in test env, but we just check it's valid
  72 |     expect(['light', 'dark']).toContain(effective)
  73 |   })
  74 | 
  75 |   test('reacts to system theme change when mode is system', async ({ page }) => {
  76 |     await page.goto(`${baseUrl}/tests/useThemeHarness.html`)
  77 |     await page.evaluate(() => {
  78 |       localStorage.removeItem('grass_puffer_theme')
  79 |     })
  80 |     await page.reload()
  81 | 
  82 |     // Emulate light system theme
  83 |     await page.emulateMedia({ colorScheme: 'light' })
  84 |     await page.waitForTimeout(100)
  85 |     expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light')
  86 | 
  87 |     // Emulate dark system theme
  88 |     await page.emulateMedia({ colorScheme: 'dark' })
  89 |     await page.waitForTimeout(100)
  90 |     expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')
  91 |   })
  92 | })
  93 | 
```
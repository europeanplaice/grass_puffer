import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/sidebarSettingsHarness.html`)
}

async function render(
  page: import('@playwright/test').Page,
  opts: { entryCount?: number } = {},
) {
  await page.evaluate(({ entryCount }) => {
    window.settingsHarness.render({ entryCount })
  }, { entryCount: opts.entryCount })
  await page.waitForSelector('.sidebar-settings')
}

test.describe('SidebarSettings — auto-save toggle', () => {
  test('is checked by default when localStorage has no value', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.removeItem('grass_puffer_autosave'))
    await render(page)

    const checkbox = page.locator('.sidebar-settings-toggle input[type="checkbox"]')
    await expect(checkbox).toBeChecked()
  })

  test('is unchecked when localStorage is set to false', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.setItem('grass_puffer_autosave', 'false'))
    await render(page)

    const checkbox = page.locator('.sidebar-settings-toggle input[type="checkbox"]')
    await expect(checkbox).not.toBeChecked()
  })

  test('toggling off persists false to localStorage', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.removeItem('grass_puffer_autosave'))
    await render(page)

    await page.locator('.sidebar-settings-toggle').click()

    const stored = await page.evaluate(() => window.settingsHarness.getStoredAutoSave())
    expect(stored).toBe('false')
    await expect(page.locator('.sidebar-settings-toggle input')).not.toBeChecked()
  })

  test('toggling on persists true to localStorage', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.setItem('grass_puffer_autosave', 'false'))
    await render(page)

    await page.locator('.sidebar-settings-toggle').click()

    const stored = await page.evaluate(() => window.settingsHarness.getStoredAutoSave())
    expect(stored).toBe('true')
    await expect(page.locator('.sidebar-settings-toggle input')).toBeChecked()
  })

  test('settings section sits below the entry list in the DOM', async ({ page }) => {
    await loadHarness(page)
    await render(page, { entryCount: 3 })

    const order = await page.evaluate(() => {
      const list = document.querySelector('.entry-list')
      const settings = document.querySelector('.sidebar-settings')
      if (!list || !settings) throw new Error('missing elements')
      const pos = list.compareDocumentPosition(settings)
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before'
    })
    expect(order).toBe('after')
  })

  test('settings section sticks to the visible bottom when the sidebar overflows', async ({ page }) => {
    await loadHarness(page)
    await render(page, { entryCount: 40 })

    const metrics = await page.evaluate(() => {
      const sidebar = document.querySelector('.sidebar') as HTMLElement
      const settings = document.querySelector('.sidebar-settings') as HTMLElement
      if (!sidebar || !settings) throw new Error('missing elements')

      const sidebarRect = sidebar.getBoundingClientRect()
      const settingsRect = settings.getBoundingClientRect()
      return {
        sidebarBottom: Math.round(sidebarRect.bottom),
        settingsBottom: Math.round(settingsRect.bottom),
      }
    })
    expect(metrics.settingsBottom).toBe(metrics.sidebarBottom)
  })

  test('has adequate touch target on mobile (min-height >= 44px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loadHarness(page)
    await render(page)

    const height = await page.locator('.sidebar-settings-toggle').evaluate(el =>
      el.getBoundingClientRect().height
    )
    expect(height).toBeGreaterThanOrEqual(44)
  })
})

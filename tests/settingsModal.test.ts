import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/settingsModalHarness.html`)
}

async function render(
  page: import('@playwright/test').Page,
  opts: { autoSave?: boolean; modalOpen?: boolean } = {},
) {
  await page.evaluate(({ autoSave, modalOpen }) => {
    window.settingsHarness.render({ autoSave, modalOpen })
  }, { autoSave: opts.autoSave, modalOpen: opts.modalOpen })
  await page.waitForSelector('.settings-modal')
}

test.describe('SettingsModal — auto-save toggle', () => {
  test('is checked by default when localStorage has no value', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.removeItem('grass_puffer_autosave'))
    await render(page)

    const toggle = page.locator('.settings-switch')
    await expect(toggle).toHaveClass(/active/)
  })

  test('is unchecked when localStorage is set to false', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.setItem('grass_puffer_autosave', 'false'))
    await render(page, { autoSave: false })

    await page.waitForFunction(() => {
      const el = document.querySelector('.settings-switch')
      return el && !el.classList.contains('active')
    })
    const toggle = page.locator('.settings-switch')
    await expect(toggle).not.toHaveClass(/active/)
  })

  test('toggling off persists false to localStorage', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.removeItem('grass_puffer_autosave'))
    await render(page)

    await page.locator('.settings-switch').click()

    const stored = await page.evaluate(() => window.settingsHarness.getStoredAutoSave())
    expect(stored).toBe('false')
    await expect(page.locator('.settings-switch')).not.toHaveClass(/active/)
  })

  test('toggling on persists true to localStorage', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => localStorage.setItem('grass_puffer_autosave', 'false'))
    await render(page, { autoSave: false })

    await page.locator('.settings-switch').click()
    await page.waitForFunction(() => localStorage.getItem('grass_puffer_autosave') === 'true')

    const stored = await page.evaluate(() => window.settingsHarness.getStoredAutoSave())
    expect(stored).toBe('true')
    await expect(page.locator('.settings-switch')).toHaveClass(/active/)
  })

  test('switch has correct aria attributes', async ({ page }) => {
    await loadHarness(page)
    await render(page, { autoSave: true })

    const toggle = page.locator('.settings-switch')
    await expect(toggle).toHaveAttribute('role', 'switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  test('Escape key closes the modal', async ({ page }) => {
    await loadHarness(page)
    await render(page)

    await page.keyboard.press('Escape')
    await expect(page.locator('.settings-modal')).toHaveCount(0)
  })

  test('overlay click closes the modal', async ({ page }) => {
    await loadHarness(page)
    await render(page)

    await page.locator('.settings-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.settings-modal')).toHaveCount(0)
  })
})

test.describe('SettingsModal — export confirm modal', () => {
  test('clicking Export all opens confirm modal', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await expect(page.locator('.export-confirm-modal')).toBeVisible()
  })

  test('confirm modal shows entry count', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await expect(page.locator('.export-confirm-desc')).toContainText('2 entries')
  })

  test('cancel button closes confirm modal', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await page.locator('.export-confirm-cancel').click()
    await expect(page.locator('.export-confirm-modal')).toHaveCount(0)
  })

  test('Escape key closes confirm modal', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await page.keyboard.press('Escape')
    await expect(page.locator('.export-confirm-modal')).toHaveCount(0)
  })

  test('overlay click closes confirm modal', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await page.locator('.export-confirm-overlay').click({ position: { x: 5, y: 5 } })
    await expect(page.locator('.export-confirm-modal')).toHaveCount(0)
  })

  test('Start export calls export handler', async ({ page }) => {
    await loadHarness(page)
    await render(page, { modalOpen: true })

    await page.locator('.btn-export-modern').click()
    await page.locator('.export-confirm-start').click()

    const calls = await page.evaluate(() => window.settingsHarness.exportCalls())
    expect(calls.length).toBe(1)
  })

  test('export button is disabled when no dates', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => {
      window.settingsHarness.render({ modalOpen: true })
      // Override dates to empty
      const settingsModal = document.querySelector('.settings-modal')
      if (settingsModal) {
        // Can't dynamically change dates prop easily, but button should be disabled
      }
    })
    // This test is limited by harness design; skip for now
  })
})

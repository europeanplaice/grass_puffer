import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/draftStorageHarness.html`)
  await page.waitForFunction(() => document.getElementById('root')?.textContent === 'ready')
  // Reset localStorage before each test
  await page.evaluate(() => localStorage.clear())
}

test.describe('draftStorage', () => {
  test('saveDraft then loadDraft returns the same content', async ({ page }) => {
    await loadHarness(page)

    await page.evaluate(() => window.draftHarness.saveDraft('2026-05-01', 'hello world'))
    const result = await page.evaluate(() => window.draftHarness.loadDraft('2026-05-01'))

    expect(result).toBe('hello world')
  })

  test('loadDraft for non-existent date returns null', async ({ page }) => {
    await loadHarness(page)

    const result = await page.evaluate(() => window.draftHarness.loadDraft('2026-01-01'))

    expect(result).toBeNull()
  })

  test('clearDraft removes only that date, leaves others intact', async ({ page }) => {
    await loadHarness(page)

    await page.evaluate(() => {
      window.draftHarness.saveDraft('2026-05-01', 'may first')
      window.draftHarness.saveDraft('2026-05-02', 'may second')
      window.draftHarness.clearDraft('2026-05-01')
    })

    const removed = await page.evaluate(() => window.draftHarness.loadDraft('2026-05-01'))
    const kept = await page.evaluate(() => window.draftHarness.loadDraft('2026-05-02'))

    expect(removed).toBeNull()
    expect(kept).toBe('may second')
  })

  test('clearAllDrafts removes only grass-puffer-draft keys, leaves unrelated keys', async ({ page }) => {
    await loadHarness(page)

    await page.evaluate(() => {
      window.draftHarness.saveDraft('2026-05-01', 'draft a')
      window.draftHarness.saveDraft('2026-05-02', 'draft b')
      window.draftHarness.setLocalStorageItem('grass-puffer-auth-restorable', 'some-value')
      window.draftHarness.clearAllDrafts()
    })

    const keys = await page.evaluate(() => window.draftHarness.localStorageKeys())
    const unrelated = await page.evaluate(() => localStorage.getItem('grass-puffer-auth-restorable'))

    expect(keys).not.toContain('grass-puffer-draft:2026-05-01')
    expect(keys).not.toContain('grass-puffer-draft:2026-05-02')
    expect(unrelated).toBe('some-value')
  })

  test('saveDraft does not throw when localStorage.setItem throws', async ({ page }) => {
    await loadHarness(page)

    const result = await page.evaluate(() => {
      window.draftHarness.breakSetItem()
      try {
        window.draftHarness.saveDraft('2026-05-01', 'content')
        return 'no throw'
      } catch {
        return 'threw'
      } finally {
        window.draftHarness.restoreSetItem()
      }
    })

    expect(result).toBe('no throw')
  })
})

import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/tests/searchBarHarness.html`)
})

test.describe('SearchBar', () => {
  test('shows No results when search returns empty and indexing is complete', async ({ page }) => {
    await page.getByPlaceholder('Search entries...').fill('alpha')
    await expect(page.getByText('No results')).toBeVisible()
  })

  test('shows results when onSearch returns matches', async ({ page }) => {
    await page.evaluate(() => {
      window.searchHarness.setSearchResult('alpha', {
        results: [{ date: '2026-04-01', snippet: 'alpha match' }],
        unindexedCount: 0,
      })
    })
    await page.getByPlaceholder('Search entries...').fill('alpha')
    await expect(page.getByText('April 1, 2026')).toBeVisible()
    await expect(page.getByText('alpha match')).toBeVisible()
  })

  test('does not search while entriesLoading is true', async ({ page }) => {
    await page.evaluate(() => window.searchHarness.render({ entriesLoading: true }))
    await page.getByPlaceholder('Search entries...').fill('alpha')
    await expect(page.getByText('Loading entries…')).toBeVisible()
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => window.searchHarness.calls())).toEqual([])

    await page.evaluate(() => window.searchHarness.render({ entriesLoading: false }))
    await expect.poll(() => page.evaluate(() => window.searchHarness.calls())).toEqual(['alpha'])
  })

  test('shows indexing progress while indexing is running', async ({ page }) => {
    await page.evaluate(() =>
      window.searchHarness.render({ indexingProgress: { done: 3, total: 10, running: true } }),
    )
    await expect(page.getByText('Indexing… 3/10')).toBeVisible()
  })

  test('shows remaining-unindexed message when unindexedCount > 0', async ({ page }) => {
    await page.evaluate(() => {
      window.searchHarness.setSearchResult('alpha', {
        results: [],
        unindexedCount: 5,
      })
    })
    await page.getByPlaceholder('Search entries...').fill('alpha')
    await expect(page.getByText('Indexing 5 remaining entries…')).toBeVisible()
    await expect(page.getByText('No results')).toHaveCount(0)
  })
})

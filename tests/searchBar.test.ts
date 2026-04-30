import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let baseUrl: string

test.beforeAll(async ({}, workerInfo) => {
  const port = 5300 + workerInfo.workerIndex
  server = await createServer({
    root: process.cwd(),
    server: { host: '127.0.0.1', port, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()
  baseUrl = server.resolvedUrls?.local[0] ?? ''
})

test.afterAll(async () => {
  await server.close()
})

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/tests/searchBarHarness.html`)
})

test.describe('SearchBar', () => {
  test('shows no results only after the latest search completes empty', async ({ page }) => {
    await page.getByPlaceholder('Search entries...').fill('alpha')

    await expect(page.getByText('No results')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.searchHarness.pending())).toEqual(['alpha'])

    await page.evaluate(() => window.searchHarness.resolveByQuery('alpha', []))

    await expect(page.getByText('No results')).toBeVisible()
  })

  test('ignores older searches that resolve after a newer query starts', async ({ page }) => {
    const input = page.getByPlaceholder('Search entries...')

    await input.fill('alpha')
    await expect.poll(() => page.evaluate(() => window.searchHarness.pending())).toEqual(['alpha'])

    await input.fill('beta')
    await expect.poll(() => page.evaluate(() => window.searchHarness.pending())).toEqual(['alpha', 'beta'])

    await page.evaluate(() => {
      window.searchHarness.resolveByQuery('alpha', [{ date: '2026-04-01', snippet: 'alpha match' }])
    })

    await expect(page.getByText('2026-04-01')).toHaveCount(0)
    await expect(page.getByText('No results')).toHaveCount(0)

    await page.evaluate(() => {
      window.searchHarness.resolveByQuery('beta', [{ date: '2026-04-02', snippet: 'beta match' }])
    })

    await expect(page.getByText('2026-04-02')).toBeVisible()
    await expect(page.getByText('beta match')).toBeVisible()
  })

  test('waits for entries to finish loading before searching', async ({ page }) => {
    await page.evaluate(() => window.searchHarness.render(true))
    await page.getByPlaceholder('Search entries...').fill('alpha')

    await expect(page.getByText('Loading entries…')).toBeVisible()
    await expect(page.getByText('No results')).toHaveCount(0)
    await page.waitForTimeout(300)
    await expect.poll(() => page.evaluate(() => window.searchHarness.pending())).toEqual([])

    await page.evaluate(() => window.searchHarness.render(false))
    await expect.poll(() => page.evaluate(() => window.searchHarness.pending())).toEqual(['alpha'])

    await page.evaluate(() => {
      window.searchHarness.resolveByQuery('alpha', [{ date: '2026-04-03', snippet: 'loaded match' }])
    })

    await expect(page.getByText('2026-04-03')).toBeVisible()
  })
})

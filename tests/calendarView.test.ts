import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let baseUrl: string

test.beforeAll(async ({}, workerInfo) => {
  const port = 5500 + workerInfo.workerIndex
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
  await page.goto(`${baseUrl}/tests/calendarViewHarness.html`)
})

test.describe('CalendarView', () => {
  test('uses regular month navigation unless Entry exists is enabled', async ({ page }) => {
    const monthSelect = page.getByLabel('Select month')

    await expect(monthSelect).toHaveValue('3')

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(monthSelect).toHaveValue('4')

    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(monthSelect).toHaveValue('3')

    await page.getByRole('checkbox', { name: 'Entry exists' }).check()

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(monthSelect).toHaveValue('5')

    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(monthSelect).toHaveValue('2')
  })
})

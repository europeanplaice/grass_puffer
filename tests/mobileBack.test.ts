import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let baseUrl: string

function adjacentDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const currentMonth = month - 1
  let next = new Date(year, currentMonth, day + 1)
  if (next.getMonth() !== currentMonth) next = new Date(year, currentMonth, day - 1)

  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
}

test.beforeAll(async ({}, workerInfo) => {
  const port = 5400 + workerInfo.workerIndex
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
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        accounts: {
          oauth2: {
            initTokenClient: (config: google.accounts.oauth2.TokenClientConfig) => {
              ;(window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady = true
              return {
                requestAccessToken: () => {
                  config.callback?.({ access_token: 'test-token' } as google.accounts.oauth2.TokenResponse)
                },
              }
            },
            revoke: () => {},
          },
        },
      },
    })
  })
  await page.route('https://accounts.google.com/gsi/client', async route => {
    await route.fulfill({ contentType: 'application/javascript', body: '' })
  })
  await page.route('https://www.googleapis.com/drive/v3/files**', async route => {
    const url = decodeURIComponent(route.request().url())
    if (url.includes("mimeType='application/vnd.google-apps.folder'")) {
      await route.fulfill({ json: { files: [{ id: 'folder-1', name: 'GrassPuffer Diary' }] } })
      return
    }
    await route.fulfill({ json: { files: [] } })
  })
})

test('mobile back from the initial entry opens the calendar instead of leaving the app', async ({ page }) => {
  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()

  await expect(page.locator('.editor-textarea')).toBeVisible()
  const entryHash = await page.evaluate(() => window.location.hash)
  expect(entryHash).toMatch(/^#\d{4}-\d{2}-\d{2}$/)

  await page.locator('.entry-date-button').click()
  await expect(page.locator('.sidebar')).toHaveClass(/open/)
  await expect(page.locator('.calendar')).toBeVisible()

  await page.mouse.click(360, 20)
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(entryHash)

  const editor = page.locator('.editor-textarea')
  await editor.fill('cursor handle')
  await editor.evaluate((node: HTMLTextAreaElement) => node.setSelectionRange(6, 6))
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('editor-textarea'))).toBe(true)
  await expect.poll(() => editor.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(6)

  await page.goBack()
  await expect(page.locator('.sidebar')).toHaveClass(/open/)
  await expect(page.locator('.calendar')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('editor-textarea'))).toBe(false)
  await expect.poll(() => editor.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBe(0)
  await expect.poll(() => editor.evaluate((node: HTMLTextAreaElement) => node.selectionEnd)).toBe(0)
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')

  await page.mouse.click(360, 20)
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(entryHash)

  await page.goBack()
  await expect(page.locator('.sidebar')).toHaveClass(/open/)
})

test('entry date opens the calendar only on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 })
  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()

  await expect(page.locator('.editor-textarea')).toBeVisible()
  await expect(page.locator('.entry-date-text')).toBeVisible()
  await expect(page.locator('.entry-date-button')).toBeHidden()

  await page.locator('.editor-header h2').click()
  await expect(page.locator('.sidebar')).not.toHaveClass(/open/)
})

test('mobile date selection confirms before leaving unsaved edits', async ({ page }) => {
  await page.goto(baseUrl)
  await page.waitForFunction(() => (window as unknown as { __tokenClientReady?: boolean }).__tokenClientReady === true)
  await page.getByRole('button', { name: 'Sign in with Google' }).click()

  const editor = page.locator('.editor-textarea')
  await expect(editor).toBeVisible()
  await editor.fill('unsaved draft')

  const currentHash = await page.evaluate(() => window.location.hash)
  const currentDate = currentHash.slice(1)
  const nextDate = adjacentDate(currentDate)

  await page.locator('.entry-date-button').click()
  await expect(page.locator('.calendar')).toBeVisible()

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('unsaved changes')
    await dialog.dismiss()
  })
  await page.getByRole('button', { name: nextDate }).click()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(currentHash)
  await expect(editor).toHaveValue('unsaved draft')
  await expect(page.locator('.sidebar')).toHaveClass(/open/)

  page.once('dialog', async dialog => {
    await dialog.accept()
  })
  await page.getByRole('button', { name: nextDate }).click()
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe(`#${nextDate}`)
  await expect(editor).toHaveValue('')
})

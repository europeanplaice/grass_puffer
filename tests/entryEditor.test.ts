import { expect, test } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer
let baseUrl: string

test.beforeAll(async ({}, workerInfo) => {
  const port = 5600 + workerInfo.workerIndex
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

async function loadHarness(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/tests/entryEditorHarness.html`)
}

async function renderEditor(
  page: import('@playwright/test').Page,
  opts: {
    date?: string
    initialContent?: string
    version?: string | null
    saveReject?: 'conflict' | 'error'
  } = {},
) {
  const date = opts.date ?? '2026-05-01'
  const initialContent = opts.initialContent ?? ''
  const version = opts.version ?? null
  await page.evaluate(
    ({ date, initialContent, version, saveReject }) => {
      window.editorHarness.render({ date, initialContent, version, saveReject })
    },
    { date, initialContent, version, saveReject: opts.saveReject },
  )
  // Wait for textarea to be visible (loading done)
  await page.waitForSelector('textarea.editor-textarea')
}

test.describe('EntryEditor — draft storage', () => {
  test('typing triggers localStorage draft write after 300ms debounce', async ({ page }) => {
    await page.clock.install()
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: '' })

    await page.fill('textarea.editor-textarea', 'my draft text')

    // Before 300ms: localStorage key should not yet exist
    const beforeKey = await page.evaluate(() =>
      localStorage.getItem('grass-puffer-draft:2026-05-01')
    )
    expect(beforeKey).toBeNull()

    // Advance clock past debounce
    await page.clock.fastForward(300)

    const afterKey = await page.evaluate(() =>
      localStorage.getItem('grass-puffer-draft:2026-05-01')
    )
    expect(afterKey).toBe('my draft text')
  })

  test('auto-save fires after 3 seconds of dirty state, silently (no saved button state)', async ({ page }) => {
    await loadHarness(page)
    await page.clock.install({ time: 0 })
    await renderEditor(page, { date: '2026-05-01', initialContent: '' })

    await page.fill('textarea.editor-textarea', 'auto-save content')
    // Ensure React has registered the auto-save timer after the fill
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)))

    // Advance the clock to exactly 3001ms — past the 3000ms auto-save threshold
    await page.clock.fastForward(3001)
    // Give React time to process the callback
    await page.waitForFunction(() => window.editorHarness.saveCalls().length > 0)

    const saveCalls = await page.evaluate(() => window.editorHarness.saveCalls())
    expect(saveCalls).toHaveLength(1)
    expect(saveCalls[0].content).toBe('auto-save content')

    // Save button should NOT show "✓ Saved" text (auto-save is silent)
    const saveButtonText = await page.locator('button.btn-save span').last().textContent()
    expect(saveButtonText).not.toContain('Saved')
    // Button shows "Save" (not in saved-celebratory state)
    expect(saveButtonText).toBe('Save')
  })

  test('auto-save does not fire while hasConflict is true', async ({ page }) => {
    await loadHarness(page)
    await page.clock.install()
    await renderEditor(page, { date: '2026-05-01', initialContent: 'original', version: '1', saveReject: 'conflict' })

    await page.fill('textarea.editor-textarea', 'edited text')

    // Click save button explicitly to get an EntryConflictError shown in the UI
    await page.locator('button.btn-save').click()
    await page.waitForSelector('.conflict-panel')

    await page.evaluate(() => window.editorHarness.clearCalls())

    // Type more content to re-arm the dirty/auto-save timer
    await page.fill('textarea.editor-textarea', 'more edits while conflicted')

    // Advance well past 3s
    await page.clock.fastForward(4000)

    // Auto-save should NOT have fired because hasConflict is true
    const saveCalls = await page.evaluate(() => window.editorHarness.saveCalls())
    expect(saveCalls).toHaveLength(0)
  })
})

test.describe('EntryEditor — draft restore banner', () => {
  test('draft banner appears when localStorage has a draft differing from loaded content', async ({ page }) => {
    await loadHarness(page)
    // Seed localStorage with a draft before rendering
    await page.evaluate(() => {
      localStorage.setItem('grass-puffer-draft:2026-05-02', 'my unsaved draft')
    })

    await renderEditor(page, { date: '2026-05-02', initialContent: 'saved content', version: '1' })

    await page.waitForSelector('.restored-banner')
    const bannerText = await page.locator('.restored-banner').textContent()
    expect(bannerText).toContain('unsaved draft')

    // Both action buttons present
    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible()
  })

  test('clicking Restore puts the draft text into the textarea and hides the banner', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => {
      localStorage.setItem('grass-puffer-draft:2026-05-03', 'draft content here')
    })

    await renderEditor(page, { date: '2026-05-03', initialContent: 'drive content', version: '1' })
    await page.waitForSelector('.restored-banner')

    await page.getByRole('button', { name: 'Restore' }).click()

    const textareaValue = await page.locator('textarea.editor-textarea').inputValue()
    expect(textareaValue).toBe('draft content here')

    await expect(page.locator('.restored-banner')).not.toBeVisible()
  })

  test('clicking Discard removes the localStorage draft and hides the banner', async ({ page }) => {
    await loadHarness(page)
    await page.evaluate(() => {
      localStorage.setItem('grass-puffer-draft:2026-05-04', 'old draft')
    })

    await renderEditor(page, { date: '2026-05-04', initialContent: 'drive content', version: '1' })
    await page.waitForSelector('.restored-banner')

    await page.getByRole('button', { name: 'Discard' }).click()

    await expect(page.locator('.restored-banner')).not.toBeVisible()

    const draftKey = await page.evaluate(() =>
      localStorage.getItem('grass-puffer-draft:2026-05-04')
    )
    expect(draftKey).toBeNull()
  })
})

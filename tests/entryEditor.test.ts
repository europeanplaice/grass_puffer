import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

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

test.describe('EntryEditor — date header', () => {
  test('shows the weekday next to the entry date', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: '' })

    const expectedWeekday = await page.evaluate(() =>
      new Date(2026, 4, 1).toLocaleDateString(undefined, { weekday: 'short' })
    )

    await expect(page.locator('.entry-date-text .entry-date-weekday')).toHaveText(expectedWeekday)
  })

  test('marks today in the entry date header', async ({ page }) => {
    await loadHarness(page)
    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    await renderEditor(page, { date: today, initialContent: '' })

    await expect(page.locator('.entry-date-text')).toHaveAttribute('data-today', 'true')
  })

  test('places mobile save action near the bottom-right thumb zone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadHarness(page)
    await renderEditor(page, { date: '2026-12-31', initialContent: 'saved content', version: '1' })

    const saveButton = page.locator('button.btn-save')
    const deleteButton = page.locator('.editor-actions > button.btn-delete')
    await expect(saveButton).toBeVisible()
    await expect(deleteButton).toBeVisible()

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.editor-header')?.getBoundingClientRect()
      const editor = document.querySelector('.editor')?.getBoundingClientRect()
      const textarea = document.querySelector('.editor-textarea')?.getBoundingClientRect()
      const save = document.querySelector('button.btn-save')?.getBoundingClientRect()
      const del = document.querySelector('.editor-actions > button.btn-delete')?.getBoundingClientRect()
      if (!header || !editor || !textarea || !save || !del) throw new Error('missing editor layout')

      const textareaStyle = getComputedStyle(document.querySelector('.editor-textarea') as HTMLElement)

      return {
        editorHeight: editor.height,
        headerLeft: header.left,
        headerRight: header.right,
        headerBottom: header.bottom,
        textareaBottom: textarea.bottom,
        textareaPaddingBottom: parseFloat(textareaStyle.paddingBottom),
        saveRight: save.right,
        saveBottom: save.bottom,
        saveTop: save.top,
        saveWidth: save.width,
        saveHeight: save.height,
        deleteTop: del.top,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })

    expect(metrics.editorHeight).toBeLessThanOrEqual(metrics.viewportHeight)
    expect(metrics.headerLeft).toBeGreaterThanOrEqual(0)
    expect(metrics.headerRight).toBeLessThanOrEqual(metrics.viewportWidth)
    expect(metrics.deleteTop).toBeLessThan(metrics.headerBottom)
    expect(metrics.saveRight).toBeLessThanOrEqual(metrics.viewportWidth - 16 + 1)
    expect(metrics.saveBottom).toBeLessThanOrEqual(metrics.viewportHeight - 16 + 1)
    expect(metrics.viewportWidth - metrics.saveRight).toBeLessThanOrEqual(17)
    expect(metrics.viewportHeight - metrics.saveBottom).toBeLessThanOrEqual(17)
    expect(metrics.saveWidth).toBeGreaterThanOrEqual(56)
    expect(metrics.saveHeight).toBeGreaterThanOrEqual(56)
    expect(metrics.textareaBottom - metrics.textareaPaddingBottom).toBeLessThanOrEqual(metrics.saveTop - 16)
  })

  test('moves the mobile save action above the visual viewport keyboard inset', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadHarness(page)

    await page.evaluate(() => {
      const viewport = new EventTarget() as unknown as VisualViewport
      Object.defineProperties(viewport, {
        height: { configurable: true, writable: true, value: window.innerHeight },
        offsetTop: { configurable: true, writable: true, value: 0 },
      })
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: viewport,
      })
    })

    await renderEditor(page, { date: '2026-12-31', initialContent: 'saved content', version: '1' })

    await page.evaluate(() => {
      Object.defineProperty(window.visualViewport, 'height', {
        configurable: true,
        writable: true,
        value: 420,
      })
      window.visualViewport?.dispatchEvent(new Event('resize'))
    })

    await expect.poll(() =>
      page.locator('button.btn-save').evaluate(button => {
        const save = button.getBoundingClientRect()
        const keyboardInset = getComputedStyle(document.documentElement)
          .getPropertyValue('--mobile-keyboard-inset-bottom')
          .trim()

        return {
          keyboardInset,
          distanceFromBottom: Math.round(window.innerHeight - save.bottom),
        }
      })
    ).toEqual({
      keyboardInset: '280px',
      distanceFromBottom: 296,
    })
  })

  test('keeps the mobile header divider stable when delete action appears after loading', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadHarness(page)

    await page.evaluate(() => {
      window.editorHarness.render({
        date: '2026-12-31',
        initialContent: 'saved content',
        version: '1',
        getContentDelayMs: 100,
      })
    })
    await page.waitForSelector('.entry-skeleton')

    const loadingHeaderBottom = await page.locator('.editor-header').evaluate(el =>
      el.getBoundingClientRect().bottom
    )

    await page.waitForSelector('textarea.editor-textarea')
    await expect(page.locator('.editor-actions > button.btn-delete')).toBeVisible()

    const loadedHeaderBottom = await page.locator('.editor-header').evaluate(el =>
      el.getBoundingClientRect().bottom
    )

    expect(loadedHeaderBottom).toBe(loadingHeaderBottom)
  })
})

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

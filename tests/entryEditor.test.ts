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
    pendingNavDate?: string | null
  } = {},
) {
  const date = opts.date ?? '2026-05-01'
  const initialContent = opts.initialContent ?? ''
  const version = opts.version ?? null
  await page.evaluate(
    ({ date, initialContent, version, saveReject, pendingNavDate }) => {
      window.editorHarness.render({ date, initialContent, version, saveReject, pendingNavDate })
    },
    { date, initialContent, version, saveReject: opts.saveReject, pendingNavDate: opts.pendingNavDate },
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

  test('shortens the month label on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadHarness(page)
    await renderEditor(page, { date: '2026-12-31', initialContent: '' })

    await expect(page.locator('.entry-date-label-full')).toBeHidden()
    await expect(page.locator('.entry-date-label-short')).toBeVisible()
    await expect(page.locator('.entry-date-label-short')).toHaveText('Dec 31, 2026')
  })

  test('keeps the full month label on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 })
    await loadHarness(page)
    await renderEditor(page, { date: '2026-09-01', initialContent: '' })

    await expect(page.locator('.entry-date-label-full')).toBeVisible()
    await expect(page.locator('.entry-date-label-full')).toHaveText('September 1, 2026')
    await expect(page.locator('.entry-date-label-short')).toBeHidden()
  })

   test('places mobile save action near the bottom-right thumb zone', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await loadHarness(page)
    await renderEditor(page, { date: '2026-12-31', initialContent: 'saved content', version: '1' })

    const saveButton = page.locator('button.btn-save')
    const moreButton = page.locator('button.btn-more')
    await expect(saveButton).toBeVisible()
    await expect(moreButton).toBeVisible()

    const metrics = await page.evaluate(() => {
      const header = document.querySelector('.editor-header')?.getBoundingClientRect()
      const editor = document.querySelector('.editor')?.getBoundingClientRect()
      const save = document.querySelector('button.btn-save')?.getBoundingClientRect()
      const more = document.querySelector('button.btn-more')?.getBoundingClientRect()
      if (!header || !editor || !save || !more) throw new Error('missing editor layout')

      return {
        editorHeight: editor.height,
        headerLeft: header.left,
        headerRight: header.right,
        headerBottom: header.bottom,
        saveRight: save.right,
        saveBottom: save.bottom,
        saveWidth: save.width,
        saveHeight: save.height,
        moreTop: more.top,
        moreCenterX: more.left + more.width / 2,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }
    })

    expect(metrics.editorHeight).toBeLessThanOrEqual(metrics.viewportHeight)
    expect(metrics.headerLeft).toBeGreaterThanOrEqual(0)
    expect(metrics.headerRight).toBeLessThanOrEqual(metrics.viewportWidth)
    expect(metrics.moreTop).toBeLessThan(metrics.headerBottom)
    expect(metrics.saveRight).toBeLessThanOrEqual(metrics.viewportWidth - 16 + 1)
    expect(metrics.saveBottom).toBeLessThanOrEqual(metrics.viewportHeight - 16 + 1)
    expect(metrics.viewportWidth - metrics.saveRight).toBeLessThanOrEqual(17)
    expect(metrics.viewportHeight - metrics.saveBottom).toBeLessThanOrEqual(17)
    expect(metrics.saveWidth).toBeGreaterThanOrEqual(56)
    expect(metrics.saveHeight).toBeGreaterThanOrEqual(56)
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
        const textarea = document.querySelector('textarea.editor-textarea')
        if (!textarea) throw new Error('missing textarea')
        const textareaStyle = getComputedStyle(textarea)
        const keyboardInset = getComputedStyle(document.documentElement)
          .getPropertyValue('--mobile-keyboard-inset-bottom')
          .trim()

        return {
          keyboardInset,
          distanceFromBottom: Math.round(window.innerHeight - save.bottom),
          textareaPaddingBottom: textareaStyle.paddingBottom,
          textareaScrollPaddingBottom: textareaStyle.scrollPaddingBottom,
        }
      })
    ).toEqual({
      keyboardInset: '280px',
      distanceFromBottom: 296,
      textareaPaddingBottom: '368px',
      textareaScrollPaddingBottom: '368px',
    })
  })

  test('keeps mobile editing scroll inside the textarea', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 520 })
    await loadHarness(page)
    await renderEditor(page, {
      date: '2026-12-31',
      initialContent: Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n'),
      version: '1',
    })

    const metrics = await page.locator('textarea.editor-textarea').evaluate(textarea => {
      const root = document.documentElement
      return {
        documentScrollable: root.scrollHeight > window.innerHeight || document.body.scrollHeight > window.innerHeight,
        textareaScrollable: textarea.scrollHeight > textarea.clientHeight,
        textareaMinHeight: getComputedStyle(textarea).minHeight,
        textareaOverscroll: getComputedStyle(textarea).overscrollBehaviorY,
      }
    })

    expect(metrics).toEqual({
      documentScrollable: false,
      textareaScrollable: true,
      textareaMinHeight: '0px',
      textareaOverscroll: 'contain',
    })
  })

  test('keeps the mobile header divider stable when more menu appears after loading', async ({ page }) => {
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
    await expect(page.locator('button.btn-more')).toBeVisible()

    const loadedHeaderBottom = await page.locator('.editor-header').evaluate(el =>
      el.getBoundingClientRect().bottom
    )

    expect(loadedHeaderBottom).toBe(loadingHeaderBottom)
  })
})

test.describe('EntryEditor — auto-save', () => {
  test('auto-save fires after 3 seconds of dirty state and briefly shows saved state', async ({ page }) => {
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

    const saveButtonText = await page.locator('button.btn-save span').last().textContent()
    expect(saveButtonText).toBe('Saved')
    await expect(page.locator('button.btn-save')).toHaveClass(/btn-saved/)
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

test.describe('EntryEditor — keyboard save', () => {
  test('Ctrl+S saves dirty content without clicking the save button', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: 'saved content', version: '1' })

    await page.fill('textarea.editor-textarea', 'keyboard saved content')
    await page.keyboard.press('Control+S')

    await expect.poll(() => page.evaluate(() => window.editorHarness.saveCalls())).toEqual([
      { date: '2026-05-01', content: 'keyboard saved content', baseVersion: '1' },
    ])
    await expect(page.locator('button.btn-save')).toHaveAttribute('aria-label', 'Saved')
  })
})

test.describe('EntryEditor — conflict resolution', () => {
  test('loads the latest remote content from the conflict panel', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: 'local base', version: '1', saveReject: 'conflict' })

    await page.fill('textarea.editor-textarea', 'local edits')
    await page.locator('button.btn-save').click()
    await page.waitForSelector('.conflict-panel')

    await page.getByRole('button', { name: 'Load latest' }).click()

    await expect(page.locator('.conflict-panel')).toHaveCount(0)
    await expect(page.locator('textarea.editor-textarea')).toHaveValue('remote content')
    const saveCalls = await page.evaluate(() => window.editorHarness.saveCalls())
    expect(saveCalls).toEqual([
      { date: '2026-05-01', content: 'local edits', baseVersion: '1' },
    ])
  })

  test('keeps local edits when resolving a conflict locally', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: 'local base', version: '1', saveReject: 'conflict' })

    await page.fill('textarea.editor-textarea', 'local edits')
    await page.locator('button.btn-save').click()
    await page.waitForSelector('.conflict-panel')

    await page.getByRole('button', { name: 'Keep local' }).click()

    await expect(page.locator('.conflict-panel')).toHaveCount(0)
    await expect(page.locator('textarea.editor-textarea')).toHaveValue('local edits')
    await expect(page.locator('button.btn-save')).toBeEnabled()
  })

  test('overwrites the remote entry with force and the remote version', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: 'local base', version: '1', saveReject: 'conflict' })

    await page.fill('textarea.editor-textarea', 'local edits')
    await page.locator('button.btn-save').click()
    await page.waitForSelector('.conflict-panel')

    await page.getByRole('button', { name: 'Overwrite' }).click()
    await expect(page.locator('.conflict-panel')).toHaveCount(0)

    const saveCalls = await page.evaluate(() => window.editorHarness.saveCalls())
    expect(saveCalls).toEqual([
      { date: '2026-05-01', content: 'local edits', baseVersion: '1' },
      { date: '2026-05-01', content: 'local edits', baseVersion: '99', force: true },
    ])
    await expect(page.locator('button.btn-save')).toHaveAttribute('aria-label', 'Saved')
  })
})

test.describe('EntryEditor — delete confirmation', () => {
  test('requires confirm before deleting an existing entry', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, { date: '2026-05-01', initialContent: 'saved content', version: '1' })

    await page.getByRole('button', { name: 'More options' }).click()
    await expect(page.locator('.more-menu')).toBeVisible()
    await page.locator('.more-menu-delete').click()
    await expect(page.getByRole('heading', { name: 'Delete entry?' })).toBeVisible()
    await expect(page.locator('.delete-modal-actions .btn-delete')).toBeDisabled()

    await page.locator('.delete-modal-input').fill('nope')
    await expect(page.locator('.delete-modal-actions .btn-delete')).toBeDisabled()
    expect(await page.evaluate(() => window.editorHarness.deleteCalls())).toEqual([])

    await page.locator('.delete-modal-input').fill('confirm')
    await page.locator('.delete-modal-actions .btn-delete').click()

    await expect(page.locator('.delete-modal')).toHaveCount(0)
    expect(await page.evaluate(() => window.editorHarness.deleteCalls())).toEqual([
      { date: '2026-05-01' },
    ])
  })
})

test.describe('EntryEditor — unsaved navigation save', () => {
  test('saves and continues pending navigation when banner save succeeds', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, {
      date: '2026-05-01',
      initialContent: 'saved content',
      version: '1',
      pendingNavDate: '2026-05-02',
    })

    await page.fill('textarea.editor-textarea', 'changed content')
    await page.locator('.unsaved-nav-banner').getByRole('button', { name: 'Save' }).click()

    expect(await page.evaluate(() => window.editorHarness.saveCalls())).toEqual([
      { date: '2026-05-01', content: 'changed content', baseVersion: '1' },
    ])
    expect(await page.evaluate(() => window.editorHarness.pendingNavigateCalls())).toEqual([
      { date: '2026-05-02' },
    ])
    expect(await page.evaluate(() => window.editorHarness.cancelNavigationCalls())).toEqual([])
    await expect(page.locator('.unsaved-nav-banner')).toHaveCount(0)
  })

  test('cancels pending navigation when banner save fails', async ({ page }) => {
    await loadHarness(page)
    await renderEditor(page, {
      date: '2026-05-01',
      initialContent: 'saved content',
      version: '1',
      saveReject: 'error',
      pendingNavDate: '2026-05-02',
    })

    await page.fill('textarea.editor-textarea', 'changed content')
    await page.locator('.unsaved-nav-banner').getByRole('button', { name: 'Save' }).click()

    expect(await page.evaluate(() => window.editorHarness.saveCalls())).toEqual([
      { date: '2026-05-01', content: 'changed content', baseVersion: '1' },
    ])
    expect(await page.evaluate(() => window.editorHarness.pendingNavigateCalls())).toEqual([])
    expect(await page.evaluate(() => window.editorHarness.cancelNavigationCalls())).toEqual([
      { date: '2026-05-02' },
    ])
    await expect(page.locator('.unsaved-nav-banner')).toHaveCount(0)
  })
})

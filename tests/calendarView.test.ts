import { expect, test } from '@playwright/test'
import { baseUrl } from './baseUrl'

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseUrl}/tests/calendarViewHarness.html`)
})

test.describe('CalendarView', () => {
  test('uses regular month navigation and can jump to today', async ({ page }) => {
    const monthSelect = page.getByLabel('Select month')

    await expect(monthSelect).toHaveValue('3')

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(monthSelect).toHaveValue('4')

    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(monthSelect).toHaveValue('3')

    await page.getByRole('button', { name: 'Today' }).click()
    const expectedMonth = await page.evaluate(() => String(new Date().getMonth()))
    const expectedYear = await page.evaluate(() => String(new Date().getFullYear()))

    await expect(monthSelect).toHaveValue(expectedMonth)
    await expect(page.getByLabel('Select year')).toHaveValue(expectedYear)
  })

  test('selects days by click and keyboard activation', async ({ page }) => {
    await page.getByRole('button', { name: '2026-04-14' }).click()
    await page.getByRole('button', { name: '2026-04-15' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: '2026-04-16' }).focus()
    await page.keyboard.press('Space')

    expect(await page.evaluate(() => window.calendarHarness.selectedDates())).toEqual([
      '2026-04-14',
      '2026-04-15',
      '2026-04-16',
    ])
  })

  test('marks entry and selected day states', async ({ page }) => {
    await page.getByLabel('Select month').selectOption('2')

    await expect(page.getByRole('button', { name: '2026-03-10' })).toHaveClass(/has-entry/)
    await expect(page.getByRole('button', { name: '2026-03-10' })).not.toHaveClass(/selected/)

    await page.getByLabel('Select month').selectOption('3')
    await expect(page.getByRole('button', { name: '2026-04-14' })).toHaveClass(/selected/)
  })
})

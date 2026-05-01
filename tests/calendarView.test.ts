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
})

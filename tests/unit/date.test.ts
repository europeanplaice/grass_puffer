import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { todayYmd, ymd, parseYmd, dateFromYmd, weekdayLabel, diaryDateLabel, daysInMonth, addMonths, formatRevisionTime } from '../../src/utils/date'

describe('date utils', () => {
  describe('todayYmd', () => {
    it('returns date string in YYYY-MM-DD format', () => {
      const result = todayYmd()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('returns consistent result within same day', () => {
      const mockDate = new Date('2026-05-15T10:30:00')
      vi.useFakeTimers()
      vi.setSystemTime(mockDate)

      const result = todayYmd()
      expect(result).toBe('2026-05-15')

      vi.useRealTimers()
    })
  })

  describe('ymd', () => {
    it('formats date correctly', () => {
      expect(ymd(2026, 5, 15)).toBe('2026-05-15')
      expect(ymd(2026, 12, 1)).toBe('2026-12-01')
      expect(ymd(2026, 1, 31)).toBe('2026-01-31')
    })

    it('pads single digits with zero', () => {
      expect(ymd(2026, 3, 5)).toBe('2026-03-05')
    })
  })

  describe('parseYmd', () => {
    it('parses valid date strings', () => {
      expect(parseYmd('2026-05-15')).toEqual({ y: 2026, m: 5, d: 15 })
      expect(parseYmd('2026-12-01')).toEqual({ y: 2026, m: 12, d: 1 })
    })

    it('returns null for invalid format', () => {
      expect(parseYmd('2026/05/15')).toBeNull()
      expect(parseYmd('26-05-15')).toBeNull()
      expect(parseYmd('abc')).toBeNull()
      expect(parseYmd('')).toBeNull()
    })

    it('rejects invalid dates like 2026-02-30', () => {
      expect(parseYmd('2026-02-30')).toBeNull()
      expect(parseYmd('2026-13-01')).toBeNull()
      expect(parseYmd('2026-00-15')).toBeNull()
      expect(parseYmd('2026-04-31')).toBeNull()
    })

    it('accepts valid edge case dates', () => {
      expect(parseYmd('2026-02-28')).toEqual({ y: 2026, m: 2, d: 28 })
      expect(parseYmd('2024-02-29')).toEqual({ y: 2024, m: 2, d: 29 }) // leap year
      expect(parseYmd('2026-12-31')).toEqual({ y: 2026, m: 12, d: 31 })
    })
  })

  describe('dateFromYmd', () => {
    it('creates Date object for valid date', () => {
      const d = dateFromYmd('2026-05-15')
      expect(d).toBeInstanceOf(Date)
      expect(d?.getFullYear()).toBe(2026)
      expect(d?.getMonth()).toBe(4) // 0-indexed
      expect(d?.getDate()).toBe(15)
    })

    it('returns null for invalid date string', () => {
      expect(dateFromYmd('invalid')).toBeNull()
      expect(dateFromYmd('2026-02-30')).toBeNull()
    })
  })

  describe('weekdayLabel', () => {
    it('returns correct weekday abbreviation', () => {
      expect(weekdayLabel('2026-05-15')).toBe('Fri') // May 15, 2026 is Friday
      expect(weekdayLabel('2026-05-16')).toBe('Sat')
      expect(weekdayLabel('2026-05-17')).toBe('Sun')
    })

    it('returns empty string for invalid date', () => {
      expect(weekdayLabel('invalid')).toBe('')
    })
  })

  describe('diaryDateLabel', () => {
    it('formats date with long month by default', () => {
      const result = diaryDateLabel('2026-05-15')
      expect(result).toContain('May')
      expect(result).toContain('15')
      expect(result).toContain('2026')
    })

    it('can use short month format', () => {
      const result = diaryDateLabel('2026-05-15', true, 'short')
      expect(result).toContain('May')
    })

    it('omits year when includeYear is false', () => {
      const withYear = diaryDateLabel('2026-05-15', true)
      const withoutYear = diaryDateLabel('2026-05-15', false)
      expect(withYear.length).toBeGreaterThan(withoutYear.length)
    })

    it('returns original string for invalid date', () => {
      expect(diaryDateLabel('invalid')).toBe('invalid')
    })
  })

  describe('daysInMonth', () => {
    it('returns correct days for each month', () => {
      expect(daysInMonth(2026, 1)).toBe(31)
      expect(daysInMonth(2026, 2)).toBe(28)
      expect(daysInMonth(2024, 2)).toBe(29) // leap year
      expect(daysInMonth(2026, 4)).toBe(30)
      expect(daysInMonth(2026, 12)).toBe(31)
    })
  })

  describe('addMonths', () => {
    it('adds months within same year', () => {
      expect(addMonths(2026, 5, 1)).toEqual({ year: 2026, month: 6 })
      expect(addMonths(2026, 11, 1)).toEqual({ year: 2026, month: 12 })
    })

    it('handles negative delta', () => {
      expect(addMonths(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
      expect(addMonths(2026, 5, -6)).toEqual({ year: 2025, month: 11 })
    })

    it('handles large deltas', () => {
      expect(addMonths(2026, 6, 12)).toEqual({ year: 2027, month: 6 })
      expect(addMonths(2026, 6, -12)).toEqual({ year: 2025, month: 6 })
    })

    it('handles multi-year transitions', () => {
      expect(addMonths(2026, 1, 25)).toEqual({ year: 2028, month: 2 })
      expect(addMonths(2026, 12, -13)).toEqual({ year: 2025, month: 11 })
    })
  })

  describe('formatRevisionTime', () => {
    const NOW = new Date('2026-05-15T14:30:00')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('shows "Today" for same-day revisions', () => {
      const result = formatRevisionTime('2026-05-15T09:15:00')
      expect(result).toMatch(/^Today \d{1,2}:\d{2} [AP]M$/)
    })

    it('shows "Yesterday" for previous day revisions', () => {
      const result = formatRevisionTime('2026-05-14T18:45:00')
      expect(result).toMatch(/^Yesterday \d{1,2}:\d{2} [AP]M$/)
    })

    it('shows "Mon DD, time" for same-year but not today/yesterday', () => {
      const result = formatRevisionTime('2026-05-10T10:00:00')
      expect(result).toMatch(/^May 10, \d{1,2}:\d{2} [AP]M$/)
    })

    it('shows full date with year for previous years', () => {
      const result = formatRevisionTime('2025-12-25T08:30:00')
      expect(result).toMatch(/^Dec 25, 2025, \d{1,2}:\d{2} [AP]M$/)
    })

    it('uses local day boundaries (timezone-safe)', () => {
      // Just before midnight - should NOT be "Today"
      const justBeforeMidnight = formatRevisionTime('2026-05-14T23:59:59')
      expect(justBeforeMidnight).toMatch(/^Yesterday/)

      // Just after midnight - should be "Today"
      const justAfterMidnight = formatRevisionTime('2026-05-15T00:00:01')
      expect(justAfterMidnight).toMatch(/^Today/)
    })
  })
})

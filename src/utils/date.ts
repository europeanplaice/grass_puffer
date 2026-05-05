export const DATE_LOCALE = 'en-US';

export function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ymd(year: number, month1to12: number, day: number): string {
  return `${year}-${String(month1to12).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function parseYmd(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  // Validate: create local date and verify components match (rejects 2026-02-30 etc.)
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return { y, m, d }
}

export function dateFromYmd(s: string): Date | null {
  const parts = parseYmd(s)
  return parts ? new Date(parts.y, parts.m - 1, parts.d) : null
}

export function weekdayLabel(date: string): string {
  const d = dateFromYmd(date)
  if (!d) return ''

  return d.toLocaleDateString(DATE_LOCALE, { weekday: 'short' })
}

export function diaryDateLabel(date: string, includeYear = true, month: 'long' | 'short' = 'long'): string {
  const d = dateFromYmd(date)
  if (!d) return date

  return d.toLocaleDateString(DATE_LOCALE, {
    month,
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  })
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(year, month1to12, 0).getDate()
}

export function addMonths(year: number, month1to12: number, delta: number): { year: number; month: number } {
  const total = month1to12 - 1 + delta
  const y = year + Math.floor(total / 12)
  const m = ((total % 12) + 12) % 12 + 1
  return { year: y, month: m }
}

/**
 * Format an ISO datetime for revision history display.
 * Uses local day boundaries to avoid timezone edge cases.
 */
export function formatRevisionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()

  // Local day boundaries (00:00:00 local time)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const dDayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  const time = d.toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })

  if (dDayStart.getTime() === todayStart.getTime()) return `Today ${time}`
  if (dDayStart.getTime() === yesterdayStart.getTime()) return `Yesterday ${time}`
  if (d.getFullYear() === now.getFullYear()) {
    const date = d.toLocaleDateString(DATE_LOCALE, { month: 'short', day: 'numeric' })
    return `${date}, ${time}`
  }
  const date = d.toLocaleDateString(DATE_LOCALE, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date}, ${time}`
}

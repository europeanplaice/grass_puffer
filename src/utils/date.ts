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
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function dateFromYmd(s: string): Date | null {
  const parts = parseYmd(s)
  return parts ? new Date(parts.y, parts.m - 1, parts.d) : null
}

export function weekdayLabel(date: string): string {
  const d = dateFromYmd(date)
  if (!d) return ''

  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

export function diaryDateLabel(date: string, includeYear = true, month: 'long' | 'short' = 'long'): string {
  const d = dateFromYmd(date)
  if (!d) return date

  return d.toLocaleDateString('en-US', {
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

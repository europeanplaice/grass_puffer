import { useEffect, useState } from 'react'
import { todayYmd, ymd as toYmdUtil, daysInMonth as daysInMonthUtil } from '../utils/date'

interface Props {
  dates: Set<string>
  selectedDate: string
  onSelect: (date: string) => void
}

function toYMD(y: number, m0: number, d: number): string {
  return toYmdUtil(y, m0 + 1, d)
}

function dateParts(ymd: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(ymd)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11) return null

  return { year, month }
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

export function CalendarView({ dates, selectedDate, onSelect }: Props) {
  const todayStr = todayYmd()
  const todayParts = dateParts(todayStr)!
  const selectedParts = dateParts(selectedDate)
  const todayYear = todayParts.year
  const [year, setYear] = useState(selectedParts?.year ?? todayYear)
  const [month, setMonth] = useState(selectedParts?.month ?? todayParts.month)

  useEffect(() => {
    if (!selectedParts) return
    setYear(selectedParts.year)
    setMonth(selectedParts.month)
  }, [selectedParts?.year, selectedParts?.month])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = daysInMonthUtil(year, month + 1)
  const entryDates = [...dates]
    .filter(date => dateParts(date))
    .sort((a, b) => a.localeCompare(b))
  const yearOptions = (() => {
    const entryYears = entryDates
      .map(date => dateParts(date)?.year)
      .filter((entryYear): entryYear is number => entryYear !== undefined)
    const minYear = Math.min(todayYear - 100, selectedParts?.year ?? todayYear, ...entryYears)
    const maxYear = Math.max(todayYear + 10, selectedParts?.year ?? todayYear, ...entryYears)

    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index)
  })()

  const prev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToToday = () => {
    setYear(todayParts.year)
    setMonth(todayParts.month)
    onSelect(todayStr)
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" onClick={prev} aria-label="Previous month">‹</button>
        <div className="calendar-title">
          <select
            className="calendar-month-select"
            aria-label="Select month"
            value={month}
            onChange={event => setMonth(Number(event.target.value))}
          >
            {MONTHS.map((monthName, index) => (
              <option key={monthName} value={index}>{monthName}</option>
            ))}
          </select>
          <select
            className="calendar-year-select"
            aria-label="Select year"
            value={year}
            onChange={event => setYear(Number(event.target.value))}
          >
            {yearOptions.map(optionYear => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={next} aria-label="Next month">›</button>
      </div>
      <div className="calendar-today-row">
        <button type="button" className="today-btn" onClick={goToToday}>Today</button>
      </div>
      <div className="calendar-grid">
        {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const ymd = toYMD(year, month, day)
          const hasEntry = dates.has(ymd)
          const isSelected = ymd === selectedDate
          const isToday = ymd === todayStr
          return (
            <div
              key={ymd}
              role="button"
              tabIndex={0}
              aria-label={ymd}
              className={['cal-day', hasEntry ? 'has-entry' : '', isSelected ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(ymd)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(ymd)
                }
              }}
            >
              {day}
              {hasEntry && <span className="dot" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

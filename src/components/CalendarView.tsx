import { useState } from 'react'

interface Props {
  dates: Set<string>
  selectedDate: string
  onSelect: (date: string) => void
}

function toYMD(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

export function CalendarView({ dates, selectedDate, onSelect }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prev = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button onClick={prev}>‹</button>
        <span>{MONTHS[month]} {year}</span>
        <button onClick={next}>›</button>
      </div>
      <div className="calendar-grid">
        {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const ymd = toYMD(year, month, day)
          const hasEntry = dates.has(ymd)
          const isSelected = ymd === selectedDate
          const isToday = ymd === toYMD(today.getFullYear(), today.getMonth(), today.getDate())
          return (
            <div
              key={ymd}
              className={['cal-day', hasEntry ? 'has-entry' : '', isSelected ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(ymd)}
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

import { useEffect, useState, useRef } from 'react'
import { motion } from 'motion/react'
import { todayYmd, ymd, daysInMonth as daysInMonthUtil, parseYmd } from '../utils/date'

interface Props {
  dates: Set<string>
  selectedDate: string
  onSelect: (date: string) => void
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December']

export function CalendarView({ dates, selectedDate, onSelect }: Props) {
  const [todayStr, setTodayStr] = useState(todayYmd)
  const todayRef = useRef(todayStr)
  todayRef.current = todayStr

  useEffect(() => {
    const tick = () => {
      const next = todayYmd()
      if (next !== todayRef.current) {
        todayRef.current = next
        setTodayStr(next)
      }
    }
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])

  const todayParsed = parseYmd(todayStr)
  const selectedParsed = parseYmd(selectedDate)
  const todayYear = todayParsed?.y ?? 0
  const [year, setYear] = useState(selectedParsed?.y ?? todayYear)
  const [month, setMonth] = useState((selectedParsed?.m ?? todayParsed?.m ?? 1) - 1)

  useEffect(() => {
    if (!selectedParsed) return
    setYear(selectedParsed.y)
    setMonth(selectedParsed.m - 1)
  }, [selectedParsed?.y, selectedParsed?.m])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = daysInMonthUtil(year, month + 1)
  const entryDates = [...dates]
    .filter(date => parseYmd(date))
    .sort((a, b) => a.localeCompare(b))
  const yearOptions = (() => {
    const entryYears = entryDates
      .map(date => parseYmd(date)?.y)
      .filter((entryYear): entryYear is number => entryYear !== undefined)
    const minYear = Math.min(todayYear - 100, selectedParsed?.y ?? todayYear, ...entryYears)
    const maxYear = Math.max(todayYear + 10, selectedParsed?.y ?? todayYear, ...entryYears)

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
    if (todayParsed) {
      setYear(todayParsed.y)
      setMonth(todayParsed.m - 1)
    }
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
        <button type="button" className="today-btn" onClick={goToToday} aria-label="Go to current month">Current Month</button>
      </div>
      <div className="calendar-grid">
        {DAYS.map(d => <div key={d} className="cal-day-label">{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />
          const dateStr = ymd(year, month + 1, day)
          const hasEntry = dates.has(dateStr)
          const isSelected = dateStr === selectedDate
          const isToday = dateStr === todayStr
          return (
            <motion.div
              key={dateStr}
              role="button"
              tabIndex={0}
              aria-label={dateStr}
              className={['cal-day', hasEntry ? 'has-entry' : '', isSelected ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(dateStr)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(dateStr)
                }
              }}
              whileTap={{ scale: 0.82 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >
              {day}
              {hasEntry && <span className="dot" />}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

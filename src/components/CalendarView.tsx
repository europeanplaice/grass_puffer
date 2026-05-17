import { useEffect, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { todayYmd, ymd, daysInMonth as daysInMonthUtil, parseYmd } from '../utils/date'
import { useI18n } from '../i18n'

interface Props {
  dates: Set<string>
  selectedDate: string
  onSelect: (date: string) => void
}

const gridVariants = {
  enter: (dir: number) => ({ x: dir * 16, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -16, opacity: 0 }),
}

export function CalendarView({ dates, selectedDate, onSelect }: Props) {
  const { t } = useI18n()
  const [todayStr, setTodayStr] = useState(todayYmd)
  const todayRef = useRef(todayStr)
  todayRef.current = todayStr
  const directionRef = useRef(0)

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
  const yearMonthRef = useRef({ year, month })
  yearMonthRef.current = { year, month }

  const setDirectionFor = (newY: number, newM: number) => {
    const { year: curY, month: curM } = yearMonthRef.current
    const cur = curY * 12 + curM
    const tgt = newY * 12 + newM
    directionRef.current = tgt > cur ? 1 : tgt < cur ? -1 : 0
  }

  useEffect(() => {
    if (!selectedParsed) return
    setDirectionFor(selectedParsed.y, selectedParsed.m - 1)
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
    directionRef.current = -1
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    directionRef.current = 1
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const goToToday = () => {
    if (todayParsed) {
      setDirectionFor(todayParsed.y, todayParsed.m - 1)
      setYear(todayParsed.y)
      setMonth(todayParsed.m - 1)
    }
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length < 42) cells.push(null)

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" onClick={prev} aria-label={t.calendar.previousMonth}>‹</button>
        <div className="calendar-title">
          <select
            className="calendar-month-select"
            aria-label={t.calendar.selectMonth}
            value={month}
            onChange={event => {
              const newMonth = Number(event.target.value)
              setDirectionFor(year, newMonth)
              setMonth(newMonth)
            }}
          >
            {t.calendar.months.map((monthName, index) => (
              <option key={monthName} value={index}>{monthName}</option>
            ))}
          </select>
          <select
            className="calendar-year-select"
            aria-label={t.calendar.selectYear}
            value={year}
            onChange={event => {
              const newYear = Number(event.target.value)
              setDirectionFor(newYear, month)
              setYear(newYear)
            }}
          >
            {yearOptions.map(optionYear => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={next} aria-label={t.calendar.nextMonth}>›</button>
      </div>
      <div className="calendar-today-row">
        <button type="button" className="today-btn" onClick={goToToday} aria-label={t.calendar.goToCurrentMonth}>{t.calendar.currentMonth}</button>
      </div>
      <div className="calendar-grid-wrap">
        <AnimatePresence mode="popLayout" custom={directionRef.current} initial={false}>
          <motion.div
            key={`${year}-${month}`}
            className="calendar-grid"
            custom={directionRef.current}
            variants={gridVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { duration: 0.2, ease: 'easeOut' },
              opacity: { duration: 0.12 },
            }}
          >
            {t.calendar.days.map(d => <div key={d} className="cal-day-label">{d}</div>)}
            {cells.map((day, i) => {
              if (day === null) return (
                <div key={`empty-${i}`} className="cal-day cal-day-empty" aria-hidden="true">
                  <span>&nbsp;</span>
                  <span className="dot" />
                </div>
              )
              const dateStr = ymd(year, month + 1, day)
              const hasEntry = dates.has(dateStr)
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === todayStr
              return (
                <motion.button
                  key={dateStr}
                  type="button"
                  aria-label={dateStr}
                  className={['cal-day', hasEntry ? 'has-entry' : '', isSelected ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
                  onClick={() => onSelect(dateStr)}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 25 }}
                >
                  {day}
                  <span className="dot" aria-hidden="true" />
                </motion.button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

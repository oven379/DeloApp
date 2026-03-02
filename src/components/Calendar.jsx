import { useState, useMemo, useEffect, useRef } from 'react'
import './Calendar.css'

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

function toDateStr(d) {
  return d.toISOString().slice(0, 10)
}

/** Количество дней в месяце: month 0–11 (январь–декабрь) */
function getDaysInMonth(year, month) {
  if (month === 1) {
    const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)
    return isLeap(year) ? 29 : 28
  }
  if ([3, 5, 8, 10].includes(month)) return 30 // апр, июнь, сен, ноя
  return 31
}

function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const startWeekday = first.getDay() === 0 ? 6 : first.getDay() - 1
  const daysInMonth = getDaysInMonth(year, month)
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
}

function getYearRange() {
  const min = new Date().getFullYear()
  return { minYear: min, maxYear: min + 3, options: [min, min + 1, min + 2, min + 3] }
}

export default function Calendar({ isOpen, onClose, selectedDate, tasks = [], onSelectDate }) {
  const { minYear: MIN_YEAR, maxYear: MAX_YEAR, options: YEAR_OPTIONS } = useMemo(getYearRange, [isOpen])
  const today = toDateStr(new Date())
  const [viewDate, setViewDate] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }))
  const [yearOpen, setYearOpen] = useState(false)
  const yearRef = useRef(null)

  useEffect(() => {
    if (!yearOpen) return
    const close = (e) => {
      if (yearRef.current && !yearRef.current.contains(e.target)) setYearOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [yearOpen])

  useEffect(() => {
    if (!isOpen) {
      setYearOpen(false)
      return
    }
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split('-').map(Number)
      const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, y))
      setViewDate({ year, month: Math.max(0, Math.min(11, m - 1)) })
    } else {
      const d = new Date()
      setViewDate({ year: d.getFullYear(), month: d.getMonth() })
    }
  }, [isOpen, selectedDate])

  const daysWithTasks = useMemo(() => {
    const set = new Set()
    tasks.forEach((t) => {
      if (t.forDay && /^\d{4}-\d{2}-\d{2}$/.test(t.forDay)) set.add(t.forDay)
    })
    return set
  }, [tasks])

  /** Даты с напоминанием: зелёная точка = напоминание дальше 7 дней, красная = в ближайшие 7 дней */
  const { daysReminderGreen, daysReminderRed } = useMemo(() => {
    const green = new Set()
    const red = new Set()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = toDateStr(today)
    const in7Days = new Date(today)
    in7Days.setDate(in7Days.getDate() + 7)
    in7Days.setHours(23, 59, 59, 999)
    const now = Date.now()
    tasks.forEach((t) => {
      if (!t.reminderAt || t.reminderAt <= now) return
      const d = new Date(t.reminderAt)
      const dateStr = toDateStr(d)
      if (dateStr < todayStr) return
      if (d <= in7Days) red.add(dateStr)
      else green.add(dateStr)
    })
    return { daysReminderGreen: green, daysReminderRed: red }
  }, [tasks])

  const grid = useMemo(
    () => getMonthGrid(viewDate.year, viewDate.month),
    [viewDate.year, viewDate.month]
  )

  const prevMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 0) {
        const y = Math.max(MIN_YEAR, prev.year - 1)
        return { year: y, month: 11 }
      }
      return { year: prev.year, month: prev.month - 1 }
    })
  }

  const nextMonth = () => {
    setViewDate((prev) => {
      if (prev.month === 11) {
        const y = Math.min(MAX_YEAR, prev.year + 1)
        return { year: y, month: 0 }
      }
      return { year: prev.year, month: prev.month + 1 }
    })
  }

  const setYear = (year) => {
    setViewDate((prev) => ({ ...prev, year: Math.min(MAX_YEAR, Math.max(MIN_YEAR, year)) }))
  }

  const handleSelect = (date) => {
    if (!date) return
    onSelectDate?.(toDateStr(date))
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <div className="calendar-overlay" role="dialog" aria-modal="true" aria-label="Выбор даты">
      <div className="calendar-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="calendar-sheet">
        <div className="calendar-header">
          <h2 className="calendar-title">Планы на день</h2>
          <button type="button" className="calendar-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="calendar-nav">
          <button type="button" className="calendar-nav-btn" onClick={prevMonth} aria-label="Предыдущий месяц">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="calendar-month-year-block" ref={yearRef}>
            <span className="calendar-month-label">{MONTHS_RU[viewDate.month]}</span>
            <span className="calendar-month-year-sep" aria-hidden="true">·</span>
            <div className="calendar-year-wrap">
              <button
                type="button"
                className="calendar-year-select"
                onClick={() => setYearOpen((v) => !v)}
                aria-label="Выбор года"
                aria-expanded={yearOpen}
                aria-haspopup="listbox"
              >
                {viewDate.year}
                <svg className="calendar-year-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {yearOpen && (
                <ul className="calendar-year-dropdown" role="listbox" aria-label="Год">
                  {YEAR_OPTIONS.map((y) => (
                    <li
                      key={y}
                      role="option"
                      aria-selected={viewDate.year === y}
                      className={'calendar-year-option' + (viewDate.year === y ? ' calendar-year-option--selected' : '')}
                      onClick={() => { setYear(y); setYearOpen(false) }}
                    >
                      {y}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <button type="button" className="calendar-nav-btn" onClick={nextMonth} aria-label="Следующий месяц">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
        <div className="calendar-weekdays">
          {WEEKDAYS_RU.map((wd) => (
            <span key={wd} className="calendar-weekday">{wd}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {grid.map((date, i) => {
            if (!date) return <div key={'e-' + i} className="calendar-cell calendar-cell--empty" />
            const dateStr = toDateStr(date)
            const isSelected = selectedDate === dateStr
            const isToday = dateStr === today
            const hasTasks = daysWithTasks.has(dateStr)
            const hasReminderRed = daysReminderRed.has(dateStr)
            const hasReminderGreen = daysReminderGreen.has(dateStr)
            const dotClass =
              hasReminderRed ? 'calendar-cell-dot calendar-cell-dot--red' :
              hasReminderGreen ? 'calendar-cell-dot calendar-cell-dot--green' :
              hasTasks ? 'calendar-cell-dot' : ''
            return (
              <button
                key={dateStr}
                type="button"
                className={'calendar-cell' + (isSelected ? ' calendar-cell--selected' : '') + (isToday ? ' calendar-cell--today' : '')}
                onClick={() => handleSelect(date)}
                aria-label={date.getDate() + ' ' + MONTHS_RU[viewDate.month] + (hasTasks ? ', есть дела' : '') + (hasReminderRed ? ', напоминание скоро' : '') + (hasReminderGreen ? ', напоминание позже' : '')}
              >
                <span className="calendar-cell-day">{date.getDate()}</span>
                {(hasReminderRed || hasReminderGreen || hasTasks) && <span className={dotClass} aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <p className="calendar-hint">
          Зелёная точка — напоминание через 7+ дней. Красная — напоминание в ближайшие 7 дней. Серая — день с делами без напоминания.
        </p>
      </div>
    </div>
  )
}

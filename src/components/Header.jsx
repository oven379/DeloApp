import { useState, useRef, useEffect } from 'react'
import './Header.css'

function formatReminderTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function timeToHourMinute(str) {
  const [h, m] = String(str || '9:00').split(':').map(Number)
  return { hour: isNaN(h) ? 9 : h, minute: isNaN(m) ? 0 : m }
}

function hourMinuteToStr(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatHeaderDate(dayView) {
  const opts = { day: 'numeric', month: 'long' }
  if (dayView === 'today') return new Date().toLocaleDateString('ru-RU', opts)
  if (dayView === 'tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toLocaleDateString('ru-RU', opts)
  }
  if (typeof dayView === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayView)) {
    const [y, m, d] = dayView.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', opts)
  }
  return new Date().toLocaleDateString('ru-RU', opts)
}

export default function Header({
  stats,
  dayView,
  onDayViewChange,
  calendarOpen,
  onCalendarOpenChange,
  theme,
  onThemeChange,
  listMode,
  onListModeChange,
  dailyNotifications = [],
  onDailyNotificationsChange,
  reminderNotifications = [],
  onDismissReminder,
  onClearAllReminders,
}) {
  const { total, done, overdue = 0 } = stats
  const badgeCount = Number(overdue) + (reminderNotifications?.length ?? 0)
  const pct = total ? (done / total) * 100 : 0
  const left = total ? total - done : 0
  const [bellOpen, setBellOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [systemThemeHintOpen, setSystemThemeHintOpen] = useState(false)
  const bellRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false)
        setSettingsOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const headerDateLabel = formatHeaderDate(dayView)

  const updateDailySlot = (index, patch) => {
    const next = [...(dailyNotifications || [])]
    while (next.length <= index) next.push({ enabled: true, hour: 9, minute: 0, text: '' })
    next[index] = { ...next[index], ...patch }
    onDailyNotificationsChange?.(next)
  }

  return (
    <header className="header">
      <div className="header-row">
        <div className="header-title-block">
          <h1 className="title">Дело</h1>
          <span className="header-date">{headerDateLabel}</span>
        </div>
        <div className="header-spacer" aria-hidden="true" />
        <div className="header-actions">
          <div
            className={`day-tabs ${calendarOpen ? 'day-tabs--calendar-open' : ''}`}
            role="tablist"
            aria-label="Сегодня или завтра"
          >
            <button
              type="button"
              role="tab"
              aria-selected={dayView === 'today'}
              aria-disabled={calendarOpen}
              disabled={calendarOpen}
              className={`day-tab ${dayView === 'today' ? 'day-tab--active' : ''}`}
              onClick={() => onDayViewChange?.('today')}
            >
              Сегодня
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={dayView === 'tomorrow'}
              aria-disabled={calendarOpen}
              disabled={calendarOpen}
              className={`day-tab ${dayView === 'tomorrow' ? 'day-tab--active' : ''}`}
              onClick={() => onDayViewChange?.('tomorrow')}
            >
              Завтра
            </button>
          </div>
          <button
            type="button"
            className="btn-calendar"
            onClick={() => onCalendarOpenChange?.(true)}
            title="Планы на другой день"
            aria-label="Открыть календарь"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>
          <div className="bell-wrap" ref={bellRef}>
            <button
              type="button"
              className="btn-bell"
              onClick={() => { setBellOpen((v) => !v); setSettingsOpen(false); }}
              title="Уведомления и настройки"
              aria-label="Уведомления и настройки"
              aria-expanded={bellOpen}
            >
              <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {badgeCount > 0 && (
                <span className="bell-badge">{badgeCount}</span>
              )}
            </button>
            {bellOpen && (
              <div className="bell-dropdown">
                <div className="bell-dropdown-tabs">
                  <button
                    type="button"
                    className={`bell-tab ${!settingsOpen ? 'bell-tab--active' : ''}`}
                    onClick={() => setSettingsOpen(false)}
                  >
                    Уведомления
                  </button>
                  <button
                    type="button"
                    className={`bell-tab ${settingsOpen ? 'bell-tab--active' : ''}`}
                    onClick={() => setSettingsOpen(true)}
                  >
                    Настройки
                  </button>
                </div>

                {!settingsOpen ? (
                  <div className="bell-dropdown-inner">
                    {reminderNotifications.length === 0 ? (
                      <p className="bell-dropdown-message">Здесь будут ваши уведомления и напоминания</p>
                    ) : (
                      <>
                        <p className="bell-dropdown-title">Напоминания</p>
                        <ul className="bell-notifications-list" aria-label="Сработавшие напоминания">
                          {reminderNotifications.map((n) => (
                            <li key={n.id} className="bell-notification-item">
                              <span className="bell-notification-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 6v6l4 2" />
                                </svg>
                              </span>
                              <div className="bell-notification-body">
                                <span className="bell-notification-text">{n.text}</span>
                                <span className="bell-notification-time">{formatReminderTime(n.firedAt)}</span>
                              </div>
                              {onDismissReminder && (
                                <button
                                  type="button"
                                  className="bell-notification-dismiss"
                                  onClick={() => onDismissReminder(n.id)}
                                  aria-label="Убрать из списка"
                                  title="Убрать"
                                >
                                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                        {onClearAllReminders && (
                          <button type="button" className="bell-clear-all" onClick={onClearAllReminders}>
                            Очистить все
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bell-settings">
                    <p className="bell-dropdown-label">Тема</p>
                    <div className="bell-list-mode">
                      <button
                        type="button"
                        className={`bell-theme-btn ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => onThemeChange?.('light')}
                      >
                        Светлая
                      </button>
                      <button
                        type="button"
                        className={`bell-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => onThemeChange?.('dark')}
                      >
                        Тёмная
                      </button>
                      <button
                        type="button"
                        className={`bell-theme-btn ${theme === 'system' ? 'active' : ''}`}
                        onClick={() => {
                          onThemeChange?.('system')
                          setSystemThemeHintOpen(true)
                        }}
                      >
                        Моя
                      </button>
                    </div>

                    <p className="bell-dropdown-label">Режим списка</p>
                    <div className="bell-list-mode">
                      <button
                        type="button"
                        className={`bell-theme-btn ${listMode === 'compact' ? 'active' : ''}`}
                        onClick={() => onListModeChange?.('compact')}
                      >
                        Компактный
                      </button>
                      <button
                        type="button"
                        className={`bell-theme-btn ${listMode === 'expanded' ? 'active' : ''}`}
                        onClick={() => onListModeChange?.('expanded')}
                      >
                        Развёрнутый
                      </button>
                    </div>

                    <p className="bell-dropdown-label">Ежедневные уведомления (раз в день)</p>
                    {(dailyNotifications || []).slice(0, 2).map((slot, idx) => (
                      <div key={idx} className="bell-daily-row">
                        <label className="bell-daily-check">
                          <input
                            type="checkbox"
                            checked={slot.enabled !== false}
                            onChange={(e) => updateDailySlot(idx, { enabled: e.target.checked })}
                          />
                          <span>{idx === 0 ? 'Утро' : 'Вечер'}</span>
                        </label>
                        <input
                          type="time"
                          className="bell-daily-time"
                          value={hourMinuteToStr(slot.hour, slot.minute)}
                          onChange={(e) => {
                            const { hour, minute } = timeToHourMinute(e.target.value)
                            updateDailySlot(idx, { hour, minute })
                          }}
                          disabled={slot.enabled === false}
                        />
                      </div>
                    ))}
                    <div className="bell-footer-row">
                      <div className="bell-version-block">
                        <span className="bell-version-main">Разработано 379team</span>
                        <span className="bell-version">Версия 1.0.0</span>
                      </div>
                      <button type="button" className="bell-support-btn" onClick={() => window.open('https://delodelai.ru', '_blank')}>
                        Поддержка
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {systemThemeHintOpen && (
        <div className="theme-hint-overlay" role="dialog" aria-modal="true" aria-labelledby="theme-hint-title">
          <div className="theme-hint-backdrop" onClick={() => setSystemThemeHintOpen(false)} aria-hidden="true" />
          <div className="theme-hint-sheet">
            <p id="theme-hint-title" className="theme-hint-text">
              При выборе опции «Моя» будет использована тема, установленная в настройках вашего устройства (светлая или тёмная).
            </p>
            <button
              type="button"
              className="theme-hint-btn"
              onClick={() => setSystemThemeHintOpen(false)}
            >
              Понятно
            </button>
          </div>
        </div>
      )}
      <div className="progress-bar-row">
        <div className="progress-bar-wrap" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} title={`${done} из ${total}`}>
          <div className={`progress-bar-fill ${pct >= 100 ? 'full' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="progress-bar-label">
          {total ? `${done}/${total}` : '0/0'}
          {left > 0 && <span className="progress-bar-left"> · {left} осталось</span>}
        </span>
      </div>
    </header>
  )
}

import { useState, useRef, useEffect } from 'react'
import { formatTaskDate, formatTaskTextToHtml, formatDayStr } from '../lib/tasks'
import './TaskItem.css'

function MiniSelect({ id, options, value, onChange, openSelectId, onOpenSelectId, 'aria-label': ariaLabel, className }) {
  const ref = useRef(null)
  const open = openSelectId === id
  const current = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOpenSelectId(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open, onOpenSelectId])

  const handleTriggerClick = () => {
    onOpenSelectId(open ? null : id)
  }

  const handleOptionClick = (val) => {
    onChange(val)
    onOpenSelectId(null)
  }

  return (
    <div className={`mini-select ${className || ''}`} ref={ref}>
      <button
        type="button"
        className="mini-select-trigger"
        onClick={handleTriggerClick}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{current.label}</span>
        <span className="mini-select-arrow">▼</span>
      </button>
      {open && (
        <div className="mini-select-dropdown" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`mini-select-option ${opt.value === value ? 'mini-select-option--on' : ''}`}
              onClick={() => handleOptionClick(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const SWIPE_THRESHOLD = 70

/** Дней в месяце: month 1–12 (январь–декабрь) */
function getDaysInMonth(year, month) {
  if (month === 2) {
    const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0)
    return isLeap(year) ? 29 : 28
  }
  if ([4, 6, 9, 11].includes(month)) return 30
  return 31
}

export default function TaskItem({
  task,
  listMode,
  index,
  isDragging,
  sortableRef,
  sortableStyle,
  sortableHandleAttributes,
  sortableHandleListeners,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
  onUpdate,
  onSetReminder,
  onPostponeToTomorrow,
  totalIncomplete,
  skipDeleteConfirm,
  onSkipDeleteConfirmForThreeDays,
}) {
  const canReorder = index !== undefined && !task.completedAt
  const hasDragHandle = Boolean(sortableHandleListeners)
  const [editing, setEditing] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteDontAskAgainChecked, setDeleteDontAskAgainChecked] = useState(false)
  const [postponeReminderModal, setPostponeReminderModal] = useState(false)
  const [reminderPastDateError, setReminderPastDateError] = useState(false)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [openReminderSelect, setOpenReminderSelect] = useState(null)
  const [textExpanded, setTextExpanded] = useState(false)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const text = task.text || ''
  const isLongText = text.split('\n').length > 3 || text.length > 150
  const TIME_PRESETS = ['09:00', '13:00', '15:00']
  const getDateFromPreset = (preset) => {
    const d = new Date()
    if (preset === 'tomorrow') d.setDate(d.getDate() + 1)
    else if (preset === 'custom') {
      const maxDay = getDaysInMonth(reminderDateCustom.year, reminderDateCustom.month)
      d.setFullYear(reminderDateCustom.year, reminderDateCustom.month - 1, Math.min(reminderDateCustom.day, maxDay))
    }
    return d
  }
  const getPresetFromDate = (ts) => {
    if (!ts) return 'today'
    const d = new Date(ts)
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    d.setHours(0, 0, 0, 0)
    const diff = Math.round((d - t) / (24 * 60 * 60 * 1000))
    if (diff === 0) return 'today'
    if (diff === 1) return 'tomorrow'
    return 'custom'
  }
  const [reminderDatePreset, setReminderDatePreset] = useState(() => getPresetFromDate(task.reminderAt))
  const [reminderDateCustom, setReminderDateCustom] = useState(() => {
    if (task.reminderAt) {
      const x = new Date(task.reminderAt)
      return { day: x.getDate(), month: x.getMonth() + 1, year: x.getFullYear() }
    }
    const t = new Date()
    return { day: t.getDate(), month: t.getMonth() + 1, year: t.getFullYear() }
  })
  const [reminderTimePreset, setReminderTimePreset] = useState(() => {
    if (!task.reminderAt) return '09:00'
    const t = new Date(task.reminderAt).toTimeString().slice(0, 5)
    return TIME_PRESETS.includes(t) ? t : 'custom'
  })
  const [reminderTimeCustom, setReminderTimeCustom] = useState(() => {
    if (!task.reminderAt) return { hour: 12, minute: 0 }
    const d = new Date(task.reminderAt)
    return { hour: d.getHours(), minute: d.getMinutes() }
  })
  const inputRef = useRef(null)
  const isOverdue = !task.completedAt && task.isOverdue
  const completed = !!task.completedAt

  const hasReminderForTodayNotFired = () => {
    if (!task.reminderAt) return false
    const now = Date.now()
    if (task.reminderAt <= now) return false
    const rd = new Date(task.reminderAt)
    const td = new Date()
    return rd.getDate() === td.getDate() &&
      rd.getMonth() === td.getMonth() &&
      rd.getFullYear() === td.getFullYear()
  }

  const handlePostponeClick = () => {
    if (hasReminderForTodayNotFired()) {
      setPostponeReminderModal(true)
    } else {
      onPostponeToTomorrow()
    }
  }

  const handlePostponeReminderEdit = () => {
    setPostponeReminderModal(false)
    const preset = getPresetFromDate(task.reminderAt)
    const t = new Date()
    setReminderDatePreset(preset)
    if (preset === 'custom' && task.reminderAt) {
      const d = new Date(task.reminderAt)
      setReminderDateCustom({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
    } else {
      setReminderDateCustom({ day: t.getDate(), month: t.getMonth() + 1, year: t.getFullYear() })
    }
    if (task.reminderAt) {
      const ts = new Date(task.reminderAt).toTimeString().slice(0, 5)
      setReminderTimePreset(TIME_PRESETS.includes(ts) ? ts : 'custom')
      setReminderTimeCustom({ hour: new Date(task.reminderAt).getHours(), minute: new Date(task.reminderAt).getMinutes() })
    }
    setShowReminderPicker(true)
    setOpenReminderSelect(null)
  }

  const handlePostponeReminderCancel = () => {
    setPostponeReminderModal(false)
  }

  const handleBlur = () => {
    setEditing(false)
    const value = inputRef.current?.value?.trim()
    if (value && value !== task.text) onUpdate(value)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    }
    if (e.key === 'Escape') {
      inputRef.current.value = task.text
      setEditing(false)
      inputRef.current?.blur()
    }
  }

  const handleDelete = () => {
    if (skipDeleteConfirm) {
      onDelete()
      return
    }
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      setDeleteDontAskAgainChecked(false)
      return
    }
    onDelete()
  }

  const confirmAndDelete = () => {
    cancelDelete()
    if (deleteDontAskAgainChecked) {
      onSkipDeleteConfirmForThreeDays?.()
    }
    onDelete()
  }

  const cancelDelete = () => {
    setDeleteConfirm(false)
  }

  const applyReminder = () => {
    const dateObj = getDateFromPreset(reminderDatePreset)
    if (reminderDatePreset === 'custom') {
      const d = new Date(reminderDateCustom.year, reminderDateCustom.month - 1, reminderDateCustom.day)
      if (isNaN(d.getTime())) return
    }
    let hour = 12
    let minute = 0
    if (reminderTimePreset === 'custom') {
      hour = reminderTimeCustom.hour
      minute = reminderTimeCustom.minute
    } else {
      const [h, m] = reminderTimePreset.split(':').map(Number)
      hour = h
      minute = m
    }
    dateObj.setHours(hour, minute, 0, 0)
    if (dateObj.getTime() <= Date.now()) {
      setReminderPastDateError(true)
      setTimeout(() => setReminderPastDateError(false), 3000)
      return
    }
    onSetReminder(dateObj.getTime())
    setOpenReminderSelect(null)
    setShowReminderPicker(false)
  }

  const clearReminder = () => {
    onSetReminder(null)
    setOpenReminderSelect(null)
    setShowReminderPicker(false)
  }

  const onTouchStart = (e) => {
    if (editing || showReminderPicker) return
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    setSwipeOffset(0)
  }

  const onTouchMove = (e) => {
    if (editing || showReminderPicker) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (Math.abs(dx) > Math.abs(dy)) {
      setSwipeOffset(Math.max(-120, Math.min(120, dx)))
    }
  }

  const onTouchEnd = () => {
    const dx = swipeOffset
    setSwipeOffset(0)
    if (dx < -SWIPE_THRESHOLD && onDelete) {
      if (skipDeleteConfirm) onDelete()
      else setDeleteConfirm(true)
    } else if (dx > SWIPE_THRESHOLD && !completed && onToggle) {
      onToggle()
    }
  }

  const style = {
    ...(hasDragHandle ? sortableStyle : {}),
    ...(swipeOffset !== 0 && !isDragging ? { transform: `translateX(${swipeOffset}px)` } : {}),
  }

  return (
    <li
      ref={sortableRef}
      style={style}
      className={`task-item ${completed ? 'task-item--completed' : ''} ${isOverdue ? 'task-item--overdue' : ''} ${isDragging ? 'task-item--dragging' : ''}`}
      data-id={task.id}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div className="task-item-inner">
        {canReorder && (
          <div
            className="task-move-buttons"
            {...(hasDragHandle ? { ...sortableHandleAttributes, ...sortableHandleListeners } : {})}
            aria-label="Изменить порядок. Удерживайте для перетаскивания."
            title="Клик — вверх/вниз. Удержание — перетащить"
          >
            <button
              type="button"
              className="task-move-btn task-move-btn--up"
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!onMoveUp}
              title="Поднять выше"
              aria-label="Поднять выше"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 18V6M6 12l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              className="task-move-btn task-move-btn--down"
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!onMoveDown}
              title="Опустить ниже"
              aria-label="Опустить ниже"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 6v12M6 12l6 6 6-6" />
              </svg>
            </button>
          </div>
        )}
        <button
          type="button"
          className="task-checkbox"
          onClick={onToggle}
          aria-label={completed ? 'Сделать снова активной' : 'Отметить выполненным'}
          title={completed ? 'Сделать снова активной' : 'Отметить выполненным'}
        >
          {completed ? '✓' : ''}
        </button>
        <div className="task-body">
          {editing ? (
            <textarea
              ref={inputRef}
              className="task-input-edit"
              defaultValue={task.text}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onFocus={(e) => {
                setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
              }}
              autoFocus
              rows={Math.min(10, Math.max(2, (task.text || '').split('\n').length + 1))}
              aria-label="Редактировать задачу"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              {(listMode === 'expanded' || (isLongText && textExpanded)) ? (
                <div className={listMode === 'expanded' ? 'task-text-expanded-block task-text-expanded-block--list-mode' : 'task-text-expanded-block'}>
                  <button
                    type="button"
                    className="task-item-text task-item-text--full"
                    onClick={(e) => { if (e.target.closest('a')) return; setEditing(true); }}
                    dangerouslySetInnerHTML={{
                      __html: (task.text && formatTaskTextToHtml(task.text)) || 'Без названия',
                    }}
                  />
                  {listMode === 'compact' && isLongText && (
                    <button
                      type="button"
                      className="task-expand-toggle"
                      onClick={(e) => { e.stopPropagation(); setTextExpanded(false); }}
                    >
                      Свернуть
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="task-item-text task-item-text--clamp-3"
                    onClick={(e) => { if (e.target.closest('a')) return; setEditing(true); }}
                    dangerouslySetInnerHTML={{
                      __html: (task.text && formatTaskTextToHtml(task.text)) || 'Без названия',
                    }}
                  />
                  {isLongText && (
                    <button
                      type="button"
                      className="task-expand-toggle"
                      onClick={(e) => { e.stopPropagation(); setTextExpanded(true); }}
                    >
                      Развернуть
                    </button>
                  )}
                </>
              )}
            </>
          )}
          <span
            className="task-date"
            title={task.updatedAt ? 'Изменено' : 'Создано'}
          >
            {task.updatedAt ? `Изменено: ${formatTaskDate(task.updatedAt)}` : `Создано: ${formatTaskDate(task.createdAt)}`}
          </span>
          {isOverdue && task.originalForDay && (
            <span className="task-date task-date--overdue" title="Перенесено с этой даты">
              Перенесено с {formatDayStr(task.originalForDay)}
            </span>
          )}
          {task.reminderAt ? (
            <span className="task-reminder-date" title="Напоминание">
              Напомнить: {formatTaskDate(task.reminderAt)}
            </span>
          ) : null}
        </div>
        <div className="task-actions">
          <button
            type="button"
            className={`btn-reminder ${task.reminderAt ? 'btn-reminder--set' : ''}`}
            onClick={() => {
              const open = !showReminderPicker
              setShowReminderPicker(open)
              setOpenReminderSelect(null)
              if (open) {
                const preset = getPresetFromDate(task.reminderAt)
                const t = new Date()
                setReminderDatePreset(preset)
                if (preset === 'custom' && task.reminderAt) {
                  const d = new Date(task.reminderAt)
                  setReminderDateCustom({ day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() })
                } else {
                  setReminderDateCustom({ day: t.getDate(), month: t.getMonth() + 1, year: t.getFullYear() })
                }
                if (task.reminderAt) {
                  const ts = new Date(task.reminderAt).toTimeString().slice(0, 5)
                  setReminderTimePreset(TIME_PRESETS.includes(ts) ? ts : 'custom')
                  setReminderTimeCustom({ hour: new Date(task.reminderAt).getHours(), minute: new Date(task.reminderAt).getMinutes() })
                } else {
                  setReminderTimePreset('09:00')
                  setReminderTimeCustom({ hour: 12, minute: 0 })
                }
              }
            }}
            title={task.reminderAt ? 'Изменить напоминание' : 'Напоминание'}
            aria-label="Напоминание"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
          </button>
          {onPostponeToTomorrow && !completed && (
            <button
              type="button"
              className="btn-postpone"
              onClick={handlePostponeClick}
              title="Перенести на завтра"
              aria-label="Перенести на завтра"
            >
              Завтра
            </button>
          )}
          <button
            type="button"
            className="btn-delete"
            onClick={handleDelete}
            aria-label="Удалить"
            title="Удалить"
          >
            🗑
          </button>
        </div>
      </div>
      {showReminderPicker && (
        <div className="task-reminder-card-wrap" onClick={(e) => e.stopPropagation()}>
          <div className="task-reminder-card">
            <div className="task-reminder-row task-reminder-row--date">
              <span className="task-reminder-row-label">День</span>
              <div className="task-reminder-pills">
                {[
                  { value: 'today', label: 'Сегодня' },
                  { value: 'tomorrow', label: 'Завтра' },
                  { value: 'custom', label: 'Дата' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    className={`task-reminder-pill ${reminderDatePreset === value ? 'task-reminder-pill--on' : ''}`}
                    onClick={() => setReminderDatePreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {reminderDatePreset === 'custom' && (() => {
                const daysInMonth = getDaysInMonth(reminderDateCustom.year, reminderDateCustom.month)
                const dayValue = Math.min(reminderDateCustom.day, daysInMonth)
                return (
                  <div className="task-reminder-custom-date">
                    <MiniSelect
                      id="reminder-day"
                      className="mini-select--date"
                      options={Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                      value={dayValue}
                      onChange={(day) => setReminderDateCustom((c) => ({ ...c, day }))}
                      openSelectId={openReminderSelect}
                      onOpenSelectId={setOpenReminderSelect}
                      aria-label="День"
                    />
                    <MiniSelect
                      id="reminder-month"
                      className="mini-select--date"
                      options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1).padStart(2, '0') }))}
                      value={reminderDateCustom.month}
                      onChange={(month) => setReminderDateCustom((c) => {
                        const maxDay = getDaysInMonth(c.year, month)
                        return { ...c, month, day: Math.min(c.day, maxDay) }
                      })}
                      openSelectId={openReminderSelect}
                      onOpenSelectId={setOpenReminderSelect}
                      aria-label="Месяц"
                    />
                    <MiniSelect
                      id="reminder-year"
                      className="mini-select--date"
                      options={[new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => ({ value: y, label: String(y) }))}
                      value={reminderDateCustom.year}
                      onChange={(year) => setReminderDateCustom((c) => {
                        const maxDay = getDaysInMonth(year, c.month)
                        return { ...c, year, day: Math.min(c.day, maxDay) }
                      })}
                      openSelectId={openReminderSelect}
                      onOpenSelectId={setOpenReminderSelect}
                      aria-label="Год"
                    />
                  </div>
                )
              })()}
            </div>
            <div className="task-reminder-row task-reminder-row--time">
              <span className="task-reminder-row-label">Время</span>
              <div className="task-reminder-pills">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`task-reminder-pill task-reminder-pill--time ${reminderTimePreset === t ? 'task-reminder-pill--on' : ''}`}
                    onClick={() => setReminderTimePreset(t)}
                  >
                    {t}
                  </button>
                ))}
                <button
                  type="button"
                  className={`task-reminder-pill task-reminder-pill--time ${reminderTimePreset === 'custom' ? 'task-reminder-pill--on' : ''}`}
                  onClick={() => setReminderTimePreset('custom')}
                >
                  Другое
                </button>
              </div>
              {reminderTimePreset === 'custom' && (
                <div className="task-reminder-custom-time">
                  <MiniSelect
                    id="reminder-hour"
                    className="mini-select--time"
                    options={Array.from({ length: 24 }, (_, i) => ({ value: i, label: String(i).padStart(2, '0') }))}
                    value={reminderTimeCustom.hour}
                    onChange={(hour) => setReminderTimeCustom((c) => ({ ...c, hour }))}
                    openSelectId={openReminderSelect}
                    onOpenSelectId={setOpenReminderSelect}
                    aria-label="Час"
                  />
                  <span className="task-reminder-time-sep">:</span>
                  <MiniSelect
                    id="reminder-minute"
                    className="mini-select--time"
                    options={Array.from({ length: 60 }, (_, m) => ({ value: m, label: String(m).padStart(2, '0') }))}
                    value={reminderTimeCustom.minute}
                    onChange={(minute) => setReminderTimeCustom((c) => ({ ...c, minute }))}
                    openSelectId={openReminderSelect}
                    onOpenSelectId={setOpenReminderSelect}
                    aria-label="Минута"
                  />
                </div>
              )}
            </div>
            {reminderPastDateError && (
              <p className="task-reminder-error" role="alert">
                Прошедшую дату установить нельзя
              </p>
            )}
            <div className="task-reminder-actions">
              <button type="button" className="btn-reminder-set" onClick={applyReminder}>
                Напомнить
              </button>
              <button type="button" className="btn-reminder-clear-text" onClick={clearReminder}>
                Убрать
              </button>
            </div>
          </div>
        </div>
      )}
      {postponeReminderModal && (
        <div className="task-delete-modal-overlay" onClick={handlePostponeReminderCancel} role="dialog" aria-modal="true" aria-labelledby="postpone-modal-title">
          <div className="task-delete-modal" onClick={(e) => e.stopPropagation()}>
            <p id="postpone-modal-title" className="task-delete-modal-text">
              На эту задачу стоит напоминание на сегодня
            </p>
            <div className="task-delete-modal-actions">
              <button type="button" className="btn-reminder-clear-text" onClick={handlePostponeReminderEdit}>
                Убрать
              </button>
              <button type="button" className="btn-cancel" onClick={handlePostponeReminderCancel}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirm && (
        <div className="task-delete-modal-overlay" onClick={cancelDelete} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="task-delete-modal" onClick={(e) => e.stopPropagation()}>
            <p id="delete-modal-title" className="task-delete-modal-text">
              Задачу нельзя будет восстановить. Удалить?
            </p>
            <div className="task-delete-modal-actions">
              <button type="button" className="btn-confirm" onClick={confirmAndDelete}>
                Удалить
              </button>
              <button type="button" className="btn-cancel" onClick={cancelDelete}>
                Отмена
              </button>
            </div>
            {onSkipDeleteConfirmForThreeDays && (
              <label className="task-delete-modal-skip">
                <input
                  type="checkbox"
                  checked={deleteDontAskAgainChecked}
                  onChange={(e) => setDeleteDontAskAgainChecked(e.target.checked)}
                />
                Больше не спрашивать (3 дня)
              </label>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { getTasks, saveTasks, getSettings, saveSettings, getSkipDeleteConfirmUntil } from './lib/storage'
import { rolloverTasks, getTodayStats, getDayStats, createTask, todayStr, tomorrowStr, getCurrentDayStr } from './lib/tasks'
import {
  isNative,
  requestPermissions,
  syncDailyNotifications,
  syncTaskReminders,
  syncOverdueReminder,
  cancelTaskReminder,
  setupBadgeListeners,
  clearBadge,
} from './lib/notifications'

const DeloBoot = registerPlugin('DeloBoot', {
  web: () => ({ getLaunchReason: async () => ({ reason: 'normal' }) }),
})
import './App.css'
import Header from './components/Header'
import TaskList from './components/TaskList'
import Input from './components/Input'
import Calendar from './components/Calendar'

const NOTIFICATION_TITLE = 'Дело'
const OVERDUE_REMINDER_MESSAGE = 'Есть не законченные дела! Сделай что-то с этим, пожалуйста)'

const TOAST_BY_LOCALE = {
  ru: 'Отлично!',
  uk: 'Чудово!',
  be: 'Выдатна!',
  de: 'Super!',
  fr: 'Parfait !',
  es: '¡Genial!',
  it: 'Ottimo!',
  pt: 'Ótimo!',
  pl: 'Świetnie!',
  tr: 'Süper!',
  zh: '太棒了！',
  ja: 'いいね！',
  ko: '좋아요!',
  ar: 'ممتاز!',
  hi: 'बहुत अच्छा!',
}

function getThankYouMessage() {
  const lang = (typeof navigator !== 'undefined' && navigator.language || '').slice(0, 2)
  return TOAST_BY_LOCALE[lang] || 'Good!'
}

function playReminderSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch (_) {}
}

function applyTheme(theme) {
  const root = document.documentElement
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [settings, setSettingsState] = useState(getSettings)
  const [reminderNotifications, setReminderNotifications] = useState([])
  const [dayView, setDayView] = useState('today')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [thankYouVisible, setThankYouVisible] = useState(false)

  const setSettings = useCallback((next) => {
    setSettingsState((prev) => {
      const out = typeof next === 'function' ? next(prev) : next
      saveSettings(out)
      applyTheme(out.theme)
      return out
    })
  }, [])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  // iOS/Capacitor: при открытии клавиатуры viewport уменьшается, но fixed/sticky элементы могут остаться под клавиатурой.
  // Поднимаем нижний Input на высоту клавиатуры через CSS-переменную.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    let raf = 0
    const update = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const keyboard = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
        document.documentElement.style.setProperty('--keyboard-offset', `${keyboard}px`)
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  useEffect(() => {
    let list = getTasks()
    const rolled = rolloverTasks(list)
    if (rolled !== list) {
      list = rolled
      saveTasks(list)
    }
    setTasks(list)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((prev) => {
        const rolled = rolloverTasks(prev)
        if (rolled !== prev) {
          saveTasks(rolled)
          return rolled
        }
        return prev
      })
    }, 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    saveTasks(tasks)
  }, [tasks])

  useEffect(() => {
    requestNotificationPermission()
    if (isNative()) {
      requestPermissions().then(() => {
        setupBadgeListeners()
        clearBadge()
        // Первая синхронизация после разрешения — пуши сработают офлайн
        syncTaskReminders(getTasks())
        syncDailyNotifications(getSettings().dailyNotifications)
        syncOverdueReminder(getTasks())
      })
    }
  }, [])

  // При возврате в приложение (свёрнуто → активно): перенос невыполненных на сегодня, если дата сменилась
  useEffect(() => {
    if (!isNative()) return
    let listenerHandle
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return
      setTasks((prev) => {
        const rolled = rolloverTasks(prev)
        if (rolled !== prev) {
          saveTasks(rolled)
          return rolled
        }
        return prev
      })
    }).then((h) => { listenerHandle = h })
    return () => { listenerHandle?.remove?.() }
  }, [])

  // После перезагрузки (только Android) система сбрасывает напоминания. Приложение запускается «в фоне»,
  // перепланирует их и закрывается. На iOS плагина DeloBoot нет — там перепланирование при открытии приложения.
  useEffect(() => {
    if (!isNative() || Capacitor.getPlatform() !== 'android') return
    let cancelled = false
    ;(async () => {
      try {
        const { reason } = await DeloBoot.getLaunchReason()
        if (cancelled || reason !== 'reschedule') return
        const tasks = getTasks()
        const settings = getSettings()
        await syncTaskReminders(tasks)
        await syncDailyNotifications(settings.dailyNotifications)
        await syncOverdueReminder(tasks)
        await CapApp.exitApp()
      } catch (_) {}
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isNative()) syncDailyNotifications(settings.dailyNotifications)
  }, [settings.dailyNotifications])

  const syncTasksRef = useRef(null)
  const addInputRef = useRef(null)

  useEffect(() => {
    if (!isNative()) return
    if (syncTasksRef.current) clearTimeout(syncTasksRef.current)
    syncTasksRef.current = setTimeout(() => {
      syncTaskReminders(tasks)
      syncOverdueReminder(tasks)
    }, 300)
    return () => { if (syncTasksRef.current) clearTimeout(syncTasksRef.current) }
  }, [tasks])

  const addTask = useCallback((text, forDay = null) => {
    const day = forDay || getCurrentDayStr(dayView)
    setTasks((prev) => {
      const forThatDay = prev.filter((t) => t.forDay === day)
      const maxOrder = forThatDay.length === 0 ? 0 : Math.max(0, ...forThatDay.map((t) => t.order ?? 0))
      return [...prev, createTask(text, maxOrder + 1, day)]
    })
  }, [dayView])

  const toggleTask = useCallback((id) => {
    const task = tasks.find((t) => t.id === id)
    const isCompleting = task && !task.completedAt
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completedAt: t.completedAt ? null : Date.now(),
              isOverdue: false,
              forDay: new Date().toISOString().slice(0, 10),
            }
          : t
      )
    )
    if (isCompleting) {
      setThankYouVisible(true)
      const t = setTimeout(() => setThankYouVisible(false), 2500)
      return () => clearTimeout(t)
    }
  }, [tasks])

  const deleteTask = useCallback((id) => {
    if (isNative()) cancelTaskReminder(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const updateTask = useCallback((id, text) => {
    const nextText = text.trim()
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? ((t.text || '').trim() === nextText
              ? t
              : { ...t, text: nextText, isOverdue: false, forDay: t.forDay, updatedAt: Date.now() })
          : t
      )
    )
  }, [])

  const postponeToTomorrow = useCallback((id) => {
    const tomorrow = tomorrowStr()
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, forDay: tomorrow, isOverdue: false } : t))
    )
  }, [])

  const setTaskReminder = useCallback((id, reminderAt) => {
    const today = todayStr()
    const tomorrow = tomorrowStr()
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t
        const next = { ...t, reminderAt: reminderAt || null }
        if (reminderAt) {
          const reminderDateStr = new Date(reminderAt).toISOString().slice(0, 10)
          if (reminderDateStr !== today && reminderDateStr !== tomorrow) {
            next.forDay = reminderDateStr
          }
        }
        if ((t.reminderAt || null) !== (reminderAt || null)) {
          next.updatedAt = Date.now()
        }
        return next
      })
    )
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      const fired = []
      setTasks((prev) => {
        let changed = false
        const next = prev.map((t) => {
          if (!t.reminderAt || t.reminderAt > now) return t
          fired.push({ taskId: t.id, text: t.text || 'Без названия' })
          changed = true
          return { ...t, reminderAt: null }
        })
        if (fired.length > 0) {
          playReminderSound()
          if (('Notification' in window) && Notification.permission === 'granted') {
            fired.forEach(({ text }) => new Notification(NOTIFICATION_TITLE, { body: text }))
          }
          fired.forEach(({ taskId }) => { if (isNative()) cancelTaskReminder(taskId) })
          setReminderNotifications((n) => [
            ...n,
            ...fired.map((f, i) => ({
              id: `rem_${f.taskId}_${now}_${i}`,
              taskId: f.taskId,
              text: f.text,
              firedAt: now,
            })),
          ])
        }
        return changed ? next : prev
      })
    }, 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const tasksRef = useRef(tasks)
  useEffect(() => { tasksRef.current = tasks }, [tasks])

  // Ежедневные уведомления: в браузере — setInterval; на нативе — Local Notifications (syncDailyNotifications)
  const sentDailyRef = useRef({})
  useEffect(() => {
    if (isNative()) return
    const list = settings.dailyNotifications || []
    const id = setInterval(() => {
      const now = new Date()
      const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const h = now.getHours()
      const m = now.getMinutes()

      list.forEach((slot, idx) => {
        if (!slot.enabled) return
        const key = `daily_${idx}_${slot.hour}_${slot.minute}`
        if (h === slot.hour && m === slot.minute && sentDailyRef.current[key] !== todayLocal) {
          sentDailyRef.current[key] = todayLocal
          playReminderSound()
          if (('Notification' in window) && Notification.permission === 'granted') {
            new Notification(NOTIFICATION_TITLE, { body: slot.text || 'Напоминание' })
          }
          setReminderNotifications((n) => [
            ...n,
            { id: `${key}_${todayLocal}_${Date.now()}`, taskId: null, text: slot.text || 'Напоминание', firedAt: Date.now() },
          ])
        }
      })

      const overdueKey = 'overdue_21_21'
      const hasOverdue = (tasksRef.current || []).some((t) => !t.completedAt && t.isOverdue)
      if (h === 21 && m === 21 && hasOverdue && sentDailyRef.current[overdueKey] !== todayLocal) {
        sentDailyRef.current[overdueKey] = todayLocal
        playReminderSound()
        if (('Notification' in window) && Notification.permission === 'granted') {
          new Notification(NOTIFICATION_TITLE, { body: OVERDUE_REMINDER_MESSAGE })
        }
        setReminderNotifications((n) => [
          ...n,
          { id: `${overdueKey}_${todayLocal}_${Date.now()}`, taskId: null, text: OVERDUE_REMINDER_MESSAGE, firedAt: Date.now() },
        ])
      }
    }, 60 * 1000)
    return () => clearInterval(id)
  }, [settings.dailyNotifications])

  const dismissReminderNotification = useCallback((notificationId) => {
    setReminderNotifications((prev) => prev.filter((n) => n.id !== notificationId))
  }, [])

  const clearAllReminderNotifications = useCallback(() => {
    setReminderNotifications([])
  }, [])

  const reorderTasks = useCallback((fromIndex, toIndex, forDay) => {
    const day = forDay || todayStr()
    setTasks((prev) => {
      const forDayIncomplete = prev.filter((t) => t.forDay === day && !t.completedAt)
      const completedSameDay = prev.filter((t) => t.forDay === day && t.completedAt)
      const rest = prev.filter((t) => t.forDay !== day)
      const list = [...forDayIncomplete]
      const [removed] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, removed)
      const reordered = list.map((t, i) => ({ ...t, order: i }))
      return [...reordered, ...completedSameDay, ...rest]
    })
  }, [])

  const currentDayStr = getCurrentDayStr(dayView)
  const stats = dayView === 'today' ? getTodayStats(tasks) : getDayStats(tasks, currentDayStr)

  const exportTasks = useCallback(() => {
    const data = JSON.stringify({ tasks, exportedAt: new Date().toISOString() }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `delo-backup-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [tasks])

  const importTasks = useCallback((file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result)
        const list = Array.isArray(json.tasks) ? json.tasks : (Array.isArray(json) ? json : [])
        if (list.length > 0 && typeof list[0].id === 'string' && typeof list[0].text === 'string') {
          setTasks(list)
        }
      } catch (_) {}
    }
    reader.readAsText(file)
  }, [])

  return (
    <div className="app">
      <Header
        stats={stats}
        dayView={dayView}
        onDayViewChange={setDayView}
        calendarOpen={calendarOpen}
        onCalendarOpenChange={setCalendarOpen}
        theme={settings.theme}
        onThemeChange={(theme) => setSettings((s) => ({ ...s, theme }))}
        listMode={settings.listMode}
        onListModeChange={(listMode) => setSettings((s) => ({ ...s, listMode }))}
        dailyNotifications={settings.dailyNotifications}
        onDailyNotificationsChange={(dailyNotifications) => setSettings((s) => ({ ...s, dailyNotifications }))}
        reminderNotifications={reminderNotifications}
        onDismissReminder={dismissReminderNotification}
        onClearAllReminders={clearAllReminderNotifications}
      />
      <Calendar
        isOpen={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        selectedDate={currentDayStr}
        tasks={tasks}
        onSelectDate={(dateStr) => { setDayView(dateStr); setCalendarOpen(false); }}
      />
      <TaskList
        tasks={tasks}
        dayView={dayView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        listMode={settings.listMode}
        onToggle={toggleTask}
        onDelete={deleteTask}
        onUpdate={updateTask}
        onSetReminder={setTaskReminder}
        onReorder={reorderTasks}
        onPostponeToTomorrow={postponeToTomorrow}
        skipDeleteConfirm={!!(settings.skipDeleteConfirmUntil && Date.now() < settings.skipDeleteConfirmUntil)}
        onSkipDeleteConfirmForThreeDays={() => setSettings((s) => ({ ...s, skipDeleteConfirmUntil: getSkipDeleteConfirmUntil() }))}
        onFocusAddInput={() => addInputRef.current?.focus()}
      />
      <Input onAdd={addTask} dayView={dayView} inputRef={addInputRef} />
      {thankYouVisible && (
        <div className="thank-you-toast" role="status" aria-live="polite">
          {getThankYouMessage()}
        </div>
      )}
    </div>
  )
}

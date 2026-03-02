/**
 * Локальное хранилище задач и настроек (localStorage).
 * Единая точка входа: весь UI читает/пишет только через getTasks/saveTasks.
 * Синхронизация с сервером или другим устройством может быть добавлена слоем
 * поверх этих функций (см. SYNC_READINESS.md в корне проекта).
 */
const TASKS_KEY = 'delo_tasks'
const SETTINGS_KEY = 'delo_settings'

export function getTasks() {
  try {
    const raw = localStorage.getItem(TASKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks))
}

const DEFAULT_DAILY = [
  { enabled: true, hour: 9, minute: 0, text: 'Проверь свои планы на сегодня. Хорошего тебе дня)' },
  { enabled: true, hour: 21, minute: 0, text: 'Проверь свои дела на завтра. Ты молодец!' },
]
const SKIP_DELETE_CONFIRM_DAYS = 3

const DEFAULT_SETTINGS = {
  theme: 'dark',
  listMode: 'compact',
  skipDeleteConfirmUntil: null,
  dailyNotifications: DEFAULT_DAILY,
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const base = { ...DEFAULT_SETTINGS, ...parsed }
    if (!Array.isArray(base.dailyNotifications) || base.dailyNotifications.length < 2) {
      base.dailyNotifications = [...DEFAULT_DAILY]
    }
    delete base.fontSize
    if ('skipDeleteConfirm' in parsed) {
      base.skipDeleteConfirmUntil = parsed.skipDeleteConfirm ? Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000 : null
      delete base.skipDeleteConfirm
      saveSettings(base)
    }
    return base
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function getSkipDeleteConfirmUntil() {
  return Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

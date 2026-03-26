export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function tomorrowStr() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Текущая выбранная дата: 'today' | 'tomorrow' | YYYY-MM-DD → строка даты */
export function getCurrentDayStr(dayView) {
  if (dayView === 'today') return todayStr()
  if (dayView === 'tomorrow') return tomorrowStr()
  if (typeof dayView === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayView)) return dayView
  return todayStr()
}

export function createTask(text, order = 0, forDay = null) {
  const now = Date.now()
  const day = forDay || todayStr()
  return {
    id: `t_${now}_${Math.random().toString(36).slice(2, 9)}`,
    text: text.trim(),
    createdAt: now,
    updatedAt: null,
    forDay: day,
    completedAt: null,
    isOverdue: false,
    order,
    reminderAt: null,
  }
}

/** Переносит невыполненные задачи с прошлых дней на сегодня с пометкой просрочки */
export function rolloverTasks(tasks) {
  const today = todayStr()
  let changed = false
  const next = tasks.map((t) => {
    if (t.completedAt) return t
    if (t.forDay < today) {
      changed = true
      return {
        ...t,
        forDay: today,
        isOverdue: true,
        originalForDay: t.originalForDay || t.forDay,
      }
    }
    return t
  })
  return changed ? next : tasks
}

/** Форматирует YYYY-MM-DD в DD.MM.YY */
export function formatDayStr(dayStr) {
  if (!dayStr || dayStr.length < 10) return dayStr
  const [y, m, d] = dayStr.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

export function formatTaskDate(ts) {
  const d = new Date(ts)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(2)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${day}.${month}.${year} · ${h}:${m}`
}

export function getTodayStats(tasks) {
  const today = todayStr()
  const forToday = tasks.filter((t) => t.forDay === today)
  const completed = forToday.filter((t) => t.completedAt != null)
  const overdue = tasks.filter((t) => !t.completedAt && t.isOverdue).length
  return {
    total: forToday.length,
    done: completed.length,
    overdue,
  }
}

/** Статистика по выбранному дню (today или tomorrow) */
export function getDayStats(tasks, dayStr) {
  const forDay = tasks.filter((t) => t.forDay === dayStr)
  const completed = forDay.filter((t) => t.completedAt != null)
  return { total: forDay.length, done: completed.length, overdue: 0 }
}

/** Нормализует номер для tel: (только цифры и ведущий +) */
function telDigits(s) {
  const t = String(s).trim()
  const hasPlus = t.startsWith('+')
  const digits = t.replace(/\D/g, '')
  return hasPlus ? '+' + digits : digits
}

/** Экранирует HTML; ссылки [текст](url) и номера телефонов делаются кликабельными */
export function formatTaskTextToHtml(text) {
  if (!text) return ''
  const escape = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  let out = escape(text)
  // Ссылки [текст](url) → кликабельная ссылка
  out = out.replace(
    /\[([^\]]*)\]\(([^)]*)\)/g,
    (_, label, url) =>
      '<a href="' +
      url.replace(/"/g, '&quot;') +
      '" target="_blank" rel="noopener noreferrer" class="task-text-link">' +
      label +
      '</a>'
  )
  // Обычные URL (https://, http://, www.) — кликабельные, как номера
  out = out.replace(
    /(^|[\s>])(https?:\/\/[^\s<>"')\]]+)/g,
    (_, before, url) =>
      before +
      '<a href="' +
      url.replace(/"/g, '&quot;') +
      '" target="_blank" rel="noopener noreferrer" class="task-text-link">' +
      url +
      '</a>'
  )
  out = out.replace(
    /(^|[\s>])(www\.[^\s<>"')\]]+)/g,
    (_, before, url) =>
      before +
      '<a href="https://' +
      url.replace(/"/g, '&quot;') +
      '" target="_blank" rel="noopener noreferrer" class="task-text-link">' +
      url +
      '</a>'
  )
  // Номера телефонов — кликабельные (tel:)
  out = out.replace(
    /(<a\s[^>]*>.*?<\/a>)|(\+?[\d][\d\s\-\(\)]{6,}[\d])/g,
    (m, insideLink, phone) => {
      if (insideLink) return insideLink
      if (!phone || telDigits(phone).length < 10) return m
      return '<a href="tel:' + telDigits(phone) + '" class="task-text-phone">' + phone + '</a>'
    }
  )
  return out
}

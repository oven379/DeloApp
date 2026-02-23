/**
 * Локальные уведомления: в браузере — Notification API, в Capacitor (Android/iOS) — Local Notifications.
 * На нативном устройстве уведомления срабатывают даже при закрытом приложении.
 *
 * Своя мелодия напоминаний: положите файл reminder.wav (рекомендуется .wav до ~30 сек):
 * — Android: frontend/android/app/src/main/res/raw/reminder.wav (имя только латиница, нижний регистр)
 * — iOS: добавьте reminder.wav в Xcode в проект App и отметьте «Add to target: App» (см. NOTIFICATION_SOUND.md)
 * При беззвучном режиме / «Не беспокоить» звук не играет — так работает система, приложение не переопределяет.
 */

const APP_TITLE = 'Дело'

/** Имя файла своей мелодии для напоминаний (без пути). Пустая строка = системный звук. */
const NOTIFICATION_SOUND = 'reminder.wav'

const ID_DAILY_MORNING = 1
const ID_DAILY_EVENING = 2
const ID_OVERDUE_REMINDER = 3
const ID_TASK_BASE = 1000

const OVERDUE_REMINDER_HOUR = 21
const OVERDUE_REMINDER_MINUTE = 21
const OVERDUE_REMINDER_MESSAGE = 'Есть не законченные дела! Сделай что-то с этим, пожалуйста)'

function taskIdToNotificationId(taskId) {
  let h = 0
  const s = String(taskId)
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return ID_TASK_BASE + (Math.abs(h) % 90000)
}

export function isNative() {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

let channelCreated = false

/** Запрос разрешения и создание канала (Android). Проверка точных будильников для доставки при заблокированном экране. */
export async function requestPermissions() {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.requestPermissions()
      if (typeof LocalNotifications.checkExactNotificationSetting === 'function') {
        await LocalNotifications.checkExactNotificationSetting().catch(() => {})
      }
      if (!channelCreated) {
        const channel = {
          id: 'delo-reminders',
          name: 'Напоминания',
          description: 'Напоминания по делам и ежедневные уведомления',
          importance: 4,
          visibility: 1,
          vibration: true,
        }
        if (NOTIFICATION_SOUND) channel.sound = NOTIFICATION_SOUND
        await LocalNotifications.createChannel(channel)
        channelCreated = true
      }
    } catch (_) {}
  } else if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission()
  }
}

/** Синхронизация ежедневных уведомлений из настроек (только для нативного приложения) */
export async function syncDailyNotifications(slots) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: ID_DAILY_MORNING }, { id: ID_DAILY_EVENING }] })
    const list = slots || []
    const toSchedule = []
    const soundOpt = NOTIFICATION_SOUND ? { sound: NOTIFICATION_SOUND } : {}
    if (list[0]?.enabled) {
      toSchedule.push({
        id: ID_DAILY_MORNING,
        title: APP_TITLE,
        body: list[0].text || 'Проверь свои планы на сегодня.',
        channelId: 'delo-reminders',
        ...soundOpt,
        schedule: { on: { hour: list[0].hour ?? 9, minute: list[0].minute ?? 0 }, repeats: true, allowWhileIdle: true },
      })
    }
    if (list[1]?.enabled) {
      toSchedule.push({
        id: ID_DAILY_EVENING,
        title: APP_TITLE,
        body: list[1].text || 'Проверь свои дела на завтра.',
        channelId: 'delo-reminders',
        ...soundOpt,
        schedule: { on: { hour: list[1].hour ?? 21, minute: list[1].minute ?? 0 }, repeats: true, allowWhileIdle: true },
      })
    }
    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule })
    }
  } catch (_) {}
}

/** Синхронизация напоминаний по задачам (только для нативного приложения) */
export async function syncTaskReminders(tasks) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const now = Date.now()
    const list = tasks || []
    const withReminder = list.filter((t) => t.reminderAt && t.reminderAt > now)
    const soundOpt = NOTIFICATION_SOUND ? { sound: NOTIFICATION_SOUND } : {}
    const toSchedule = withReminder.map((t) => ({
      id: taskIdToNotificationId(t.id),
      title: APP_TITLE,
      body: (t.text || 'Без названия').slice(0, 100),
      channelId: 'delo-reminders',
      ...soundOpt,
      schedule: { at: new Date(t.reminderAt), allowWhileIdle: true },
    }))
    const scheduledIds = new Set(toSchedule.map((n) => n.id))
    const toCancel = list
      .filter((t) => !t.reminderAt || t.reminderAt <= now)
      .map((t) => taskIdToNotificationId(t.id))
      .filter((id) => !scheduledIds.has(id))
      .map((id) => ({ id }))
    if (toCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: toCancel })
    }
    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: toSchedule })
    }
  } catch (_) {}
}

/**
 * Синхронизация напоминания о просроченных делах в 21:21.
 * Планируется только если есть просроченные задачи; отменяется, если их нет.
 * Если сегодня 21:21 уже прошло — планируем на завтра (офлайн, после перезагрузки).
 */
export async function syncOverdueReminder(tasks) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const hasOverdue = (tasks || []).some((t) => !t.completedAt && t.isOverdue)
    await LocalNotifications.cancel({ notifications: [{ id: ID_OVERDUE_REMINDER }] })
    if (!hasOverdue) return
    const now = new Date()
    let scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), OVERDUE_REMINDER_HOUR, OVERDUE_REMINDER_MINUTE, 0)
    if (scheduled.getTime() <= now.getTime()) {
      scheduled.setDate(scheduled.getDate() + 1)
    }
    const soundOpt = NOTIFICATION_SOUND ? { sound: NOTIFICATION_SOUND } : {}
    await LocalNotifications.schedule({
      notifications: [{
        id: ID_OVERDUE_REMINDER,
        title: APP_TITLE,
        body: OVERDUE_REMINDER_MESSAGE,
        channelId: 'delo-reminders',
        ...soundOpt,
        schedule: { at: scheduled, allowWhileIdle: true },
      }],
    })
  } catch (_) {}
}

/** Отменить напоминание по задаче (когда оно уже сработало в приложении) */
export async function cancelTaskReminder(taskId) {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({
      notifications: [{ id: taskIdToNotificationId(taskId) }],
    })
  } catch (_) {}
}

/**
 * Увеличить бейдж на иконке приложения (при приходе напоминания/пуша).
 * Вызывается при показе локального уведомления.
 */
export async function increaseBadge() {
  if (!isNative()) return
  try {
    const { Badge } = await import('@capawesome/capacitor-badge')
    const res = await Badge.isSupported()
    if (res?.supported) await Badge.increase()
  } catch (_) {}
}

/**
 * Очистить бейдж на иконке (при открытии приложения).
 */
export async function clearBadge() {
  if (!isNative()) return
  try {
    const { Badge } = await import('@capawesome/capacitor-badge')
    await Badge.clear()
  } catch (_) {}
}

/**
 * Подписаться на показ уведомлений и обновлять бейдж на иконке.
 * Локальные уведомления работают без интернета.
 */
export async function setupBadgeListeners() {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { App } = await import('@capacitor/app')
    await LocalNotifications.addListener('localNotificationReceived', () => {
      increaseBadge()
    })
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) clearBadge()
    })
  } catch (_) {}
}

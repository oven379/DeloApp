import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DailyNotificationSlot, Task } from '../types';

const APP_TITLE = 'Дело';
const CHANNEL_ID = 'delo-reminders';

const TAG_DAILY_MORNING = 'daily_morning';
const TAG_DAILY_EVENING = 'daily_evening';
const TAG_OVERDUE = 'overdue_2121';
const TAG_TASK = 'task_reminder';

const OVERDUE_REMINDER_HOUR = 21;
const OVERDUE_REMINDER_MINUTE = 21;
const OVERDUE_REMINDER_MESSAGE = 'Есть не законченные дела! Сделай что-то с этим, пожалуйста)';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Напоминания',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4caf50',
    // NOTE: кастомный звук требует добавления файла в android res/raw при сборке.
    // Пока используем системный звук, чтобы всё работало в Expo Go.
  });
}

export async function requestPermissions() {
  await ensureAndroidChannel();
  const res = await Notifications.requestPermissionsAsync();
  return res;
}

async function cancelByTag(tag: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled
    .filter((n) => {
      const data = n.content?.data as Record<string, unknown> | undefined;
      return data && String(data.tag) === tag;
    })
    .map((n) => n.identifier);
  for (const id of toCancel) await Notifications.cancelScheduledNotificationAsync(id);
}

async function cancelTaskById(taskId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled
    .filter((n) => (n.content?.data as any)?.tag === TAG_TASK && (n.content?.data as any)?.taskId === taskId)
    .map((n) => n.identifier);
  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function syncDailyNotifications(slots: DailyNotificationSlot[]) {
  await ensureAndroidChannel();
  await cancelByTag(TAG_DAILY_MORNING);
  await cancelByTag(TAG_DAILY_EVENING);

  const list = slots || [];
  const toSchedule: Promise<string>[] = [];

  if (list[0]?.enabled) {
    toSchedule.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: APP_TITLE,
          body: list[0].text || 'Проверь свои планы на сегодня.',
          data: { tag: TAG_DAILY_MORNING },
          sound: Platform.OS === 'android' ? undefined : undefined,
        },
        trigger: { hour: list[0].hour ?? 9, minute: list[0].minute ?? 0, repeats: true, channelId: CHANNEL_ID } as any,
      })
    );
  }
  if (list[1]?.enabled) {
    toSchedule.push(
      Notifications.scheduleNotificationAsync({
        content: {
          title: APP_TITLE,
          body: list[1].text || 'Проверь свои дела на завтра.',
          data: { tag: TAG_DAILY_EVENING },
        },
        trigger: { hour: list[1].hour ?? 21, minute: list[1].minute ?? 0, repeats: true, channelId: CHANNEL_ID } as any,
      })
    );
  }

  await Promise.all(toSchedule);
}

export async function syncTaskReminders(tasks: Task[]) {
  await ensureAndroidChannel();
  const now = Date.now();
  const list = tasks || [];
  const withReminder = list.filter((t) => t.reminderAt && t.reminderAt > now);
  const withoutReminder = list.filter((t) => !t.reminderAt || (t.reminderAt ?? 0) <= now);

  await Promise.all(withoutReminder.map((t) => cancelTaskById(t.id)));
  await Promise.all(
    withReminder.map(async (t) => {
      await cancelTaskById(t.id);
      const taskSummary = (t.text || 'Без названия').trim().slice(0, 80);
      const body = taskSummary ? `Напоминание: ${taskSummary}` : 'Напоминание о деле';
      await Notifications.scheduleNotificationAsync({
        content: {
          title: APP_TITLE,
          body,
          data: { tag: TAG_TASK, taskId: t.id },
        },
        trigger: { date: new Date(t.reminderAt!), channelId: CHANNEL_ID } as any,
      });
    })
  );
}

export async function syncOverdueReminder(tasks: Task[]) {
  await ensureAndroidChannel();
  await cancelByTag(TAG_OVERDUE);
  const hasOverdue = (tasks || []).some((t) => !t.completedAt && t.isOverdue);
  if (!hasOverdue) return;

  const now = new Date();
  let scheduled = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    OVERDUE_REMINDER_HOUR,
    OVERDUE_REMINDER_MINUTE,
    0,
    0
  );
  if (scheduled.getTime() <= now.getTime()) scheduled.setDate(scheduled.getDate() + 1);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: APP_TITLE,
      body: OVERDUE_REMINDER_MESSAGE,
      data: { tag: TAG_OVERDUE },
    },
    trigger: { date: scheduled, channelId: CHANNEL_ID } as any,
  });
}


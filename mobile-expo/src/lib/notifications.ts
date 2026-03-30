import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DailyNotificationSlot, Task } from '../types';

const APP_TITLE = 'Дело';
const CHANNEL_ID = 'delo-reminders';

const TAG_DAILY_MORNING = 'daily_morning';
const TAG_DAILY_EVENING = 'daily_evening';
const TAG_OVERDUE = 'overdue_2121';
const TAG_TASK = 'task_reminder';

// Overdue reminders were removed: keep TAG_OVERDUE only to cancel old scheduled notifications.

let taskSyncChain: Promise<void> = Promise.resolve();

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
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4caf50',
    sound: 'default',
  });
}

export async function requestPermissions() {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return current;
  }
  const res = await Notifications.requestPermissionsAsync();
  return res;
}

async function hasNotificationPermission() {
  const p = await Notifications.getPermissionsAsync();
  return !!(p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

// (debug helpers removed from UI)

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
  if (!(await hasNotificationPermission())) {
    console.warn('[notifications] permission denied: skip daily notifications');
    return;
  }
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
          sound: 'default',
          ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : null),
        },
        // Only 09:00
        trigger:
          Platform.OS === 'android'
            ? ({ hour: 9, minute: 0, repeats: true, channelId: CHANNEL_ID } as any)
            : ({ hour: 9, minute: 0, repeats: true } as any),
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
          sound: 'default',
          ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : null),
        },
        // Only 21:00
        trigger:
          Platform.OS === 'android'
            ? ({ hour: 21, minute: 0, repeats: true, channelId: CHANNEL_ID } as any)
            : ({ hour: 21, minute: 0, repeats: true } as any),
      })
    );
  }

  try {
    await Promise.all(toSchedule);
  } catch (e) {
    console.warn('[notifications] syncDailyNotifications failed', e);
  }
}

export async function syncTaskReminders(tasks: Task[]) {
  // Serialize sync calls to prevent race conditions that can create duplicate scheduled notifications.
  // Example race: two syncTaskReminders() calls run concurrently → both cancel (nothing yet) → both schedule → duplicates.
  taskSyncChain = taskSyncChain
    .catch(() => {})
    .then(async () => {
      await ensureAndroidChannel();
      if (!(await hasNotificationPermission())) {
        console.warn('[notifications] permission denied: skip task reminders');
        return;
      }
      const now = Date.now();
      const list = tasks || [];
      const withReminder = list.filter((t) => t.reminderAt && t.reminderAt > now);
      const withoutReminder = list.filter((t) => !t.reminderAt || (t.reminderAt ?? 0) <= now);

      await Promise.all(
        withoutReminder.map(async (t) => {
          try {
            await cancelTaskById(t.id);
          } catch (e) {
            console.warn('[notifications] cancelTaskById failed', { taskId: t.id, e });
          }
        })
      );
      await Promise.all(
        withReminder.map(async (t) => {
          try {
            await cancelTaskById(t.id);
          } catch (e) {
            console.warn('[notifications] cancelTaskById before schedule failed', { taskId: t.id, e });
          }
          const taskSummary = (t.text || 'Без названия').trim().slice(0, 80);
          const body = taskSummary ? `Напоминание: ${taskSummary}` : 'Напоминание о деле';
          try {
            // Android is more reliable with timestamp-based trigger (ms) rather than Date object in some environments/emulators.
            const trigger =
              Platform.OS === 'android'
                ? ({ timestamp: Math.floor((t.reminderAt ?? 0) / 1000), channelId: CHANNEL_ID } as any)
                : (new Date(t.reminderAt!) as any);
            await Notifications.scheduleNotificationAsync({
              content: {
                title: APP_TITLE,
                body,
                data: { tag: TAG_TASK, taskId: t.id },
                sound: 'default',
                ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : null),
              },
              trigger,
            });
          } catch (e) {
            console.warn('[notifications] scheduleNotificationAsync failed', { taskId: t.id, reminderAt: t.reminderAt, e });
          }
        })
      );
    });

  await taskSyncChain;
}

export async function disableOverdueReminders() {
  await ensureAndroidChannel();
  await cancelByTag(TAG_OVERDUE);
}


import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { DailyNotificationSlot, Task } from '../types';
import { planDailyNotifications, planTaskReminders } from './notificationPlanning';

const APP_TITLE = 'Дело';
const CHANNEL_ID = 'delo-reminders-v2';
const NOTIFICATION_SOUND = 'reminder.wav';

const TAG_OVERDUE = 'overdue_2121';
const TAG_TASK = 'task_reminder';

// Overdue reminders were removed: keep TAG_OVERDUE only to cancel old scheduled notifications.

let taskSyncChain: Promise<void> = Promise.resolve();
let dailySyncChain: Promise<void> = Promise.resolve();

const TriggerTypes = Notifications.SchedulableTriggerInputTypes;

function isNativeNotificationsAvailable() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

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
    sound: NOTIFICATION_SOUND,
  });
}

export async function requestPermissions() {
  if (!isNativeNotificationsAvailable()) return null;
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return current;
  }
  const res = await Notifications.requestPermissionsAsync();
  return res;
}

async function hasNotificationPermission() {
  if (!isNativeNotificationsAvailable()) return false;
  const p = await Notifications.getPermissionsAsync();
  return !!(p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

// (debug helpers removed from UI)

async function cancelByTag(tag: string) {
  if (!isNativeNotificationsAvailable()) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled
    .filter((n) => {
      const data = n.content?.data as Record<string, unknown> | undefined;
      return data && String(data.tag) === tag;
    })
    .map((n) => n.identifier);
  for (const id of toCancel) await Notifications.cancelScheduledNotificationAsync(id);
}

async function cancelByIdentifier(identifier: string) {
  if (!isNativeNotificationsAvailable()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {}
}

async function cancelTaskById(taskId: string) {
  if (!isNativeNotificationsAvailable()) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled
    .filter((n) => (n.content?.data as any)?.tag === TAG_TASK && (n.content?.data as any)?.taskId === taskId)
    .map((n) => n.identifier);
  await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function syncDailyNotifications(slots: DailyNotificationSlot[]) {
  if (!isNativeNotificationsAvailable()) return;
  dailySyncChain = dailySyncChain
    .catch(() => {})
    .then(async () => {
      await ensureAndroidChannel();
      if (!(await hasNotificationPermission())) {
        console.warn('[notifications] permission denied: skip daily notifications');
        return;
      }
      await Promise.all([
        cancelByIdentifier('delo_daily_morning'),
        cancelByIdentifier('delo_daily_evening'),
        cancelByTag('daily_morning'),
        cancelByTag('daily_evening'),
      ]);

      const plans = planDailyNotifications(slots);
      const toSchedule = plans.map((plan) =>
        Notifications.scheduleNotificationAsync({
          identifier: plan.identifier,
          content: {
            title: APP_TITLE,
            body: plan.body,
            data: { tag: plan.tag },
            sound: NOTIFICATION_SOUND,
            ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : null),
          },
          trigger: {
            type: TriggerTypes.DAILY,
            hour: plan.hour,
            minute: plan.minute,
            ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
          } as any,
        })
      );

      try {
        await Promise.all(toSchedule);
      } catch (e) {
        console.warn('[notifications] syncDailyNotifications failed', e);
      }
    });

  await dailySyncChain;
}

export async function syncTaskReminders(tasks: Task[]) {
  if (!isNativeNotificationsAvailable()) return;
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
      const list = tasks || [];
      const plans = planTaskReminders(list);
      const planByTaskId = new Map(plans.map((plan) => [plan.taskId, plan]));
      const withoutReminder = list.filter((t) => !planByTaskId.has(t.id));

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
        plans.map(async (plan) => {
          try {
            await cancelTaskById(plan.taskId);
          } catch (e) {
            console.warn('[notifications] cancelTaskById before schedule failed', { taskId: plan.taskId, e });
          }
          try {
            const trigger = {
              type: TriggerTypes.DATE,
              date: new Date(plan.reminderAt),
              ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null),
            } as any;
            await Notifications.scheduleNotificationAsync({
              identifier: `delo_task_${plan.taskId}`,
              content: {
                title: APP_TITLE,
                body: plan.body,
                data: { tag: TAG_TASK, taskId: plan.taskId },
                sound: NOTIFICATION_SOUND,
                ...(Platform.OS === 'android' ? { android: { channelId: CHANNEL_ID } } : null),
              },
              trigger,
            });
          } catch (e) {
            console.warn('[notifications] scheduleNotificationAsync failed', { taskId: plan.taskId, reminderAt: plan.reminderAt, e });
          }
        })
      );
    });

  await taskSyncChain;
}

export async function disableOverdueReminders() {
  if (!isNativeNotificationsAvailable()) return;
  await ensureAndroidChannel();
  await cancelByTag(TAG_OVERDUE);
}

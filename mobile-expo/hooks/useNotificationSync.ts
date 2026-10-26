import { useEffect, useMemo, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Settings, Task } from '../src/types';
import { getPendingTodayCount } from '../src/lib/tasks';
import { disableOverdueReminders, syncDailyNotifications, syncTaskReminders } from '../src/lib/notifications';

interface Deps {
  tasks: Task[];
  settings: Settings | null;
  tasksRef: React.MutableRefObject<Task[]>;
  dailySlotsRef: React.MutableRefObject<Settings['dailyNotifications']>;
}

export function useNotificationSync({ tasks, settings, tasksRef, dailySlotsRef }: Deps) {
  const settingsReady = !!settings;

  const taskRemindersKey = useMemo(
    () => tasks.map((t) => `${t.id}:${t.reminderAt ?? 0}`).join('|'),
    [tasks]
  );

  const dailyNotificationsKey = useMemo(() => {
    const list = settings?.dailyNotifications ?? [];
    return list.map((s) => `${s.enabled ? 1 : 0}:${s.hour}:${s.minute}:${s.text}`).join('|');
  }, [settings?.dailyNotifications]);

  const pendingToday = useMemo(() => getPendingTodayCount(tasks), [tasks]);

  // Число невыполненных дел на сегодня — на значке приложения.
  useEffect(() => {
    if (!settingsReady || Platform.OS === 'web') return;
    Notifications.setBadgeCountAsync(pendingToday).catch(() => {});
  }, [pendingToday, settingsReady]);

  const tasksSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dailySyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!settingsReady) return;
    if (tasksSyncRef.current) clearTimeout(tasksSyncRef.current);
    tasksSyncRef.current = setTimeout(() => {
      Promise.all([syncTaskReminders(tasksRef.current), disableOverdueReminders()]).catch((e) =>
        console.warn('[notifications] sync tasks failed', e)
      );
    }, 800);
    return () => {
      if (tasksSyncRef.current) clearTimeout(tasksSyncRef.current);
    };
  }, [taskRemindersKey, settingsReady, tasksRef]);

  useEffect(() => {
    if (!settingsReady) return;
    if (dailySyncRef.current) clearTimeout(dailySyncRef.current);
    dailySyncRef.current = setTimeout(() => {
      syncDailyNotifications(dailySlotsRef.current).catch((e) =>
        console.warn('[notifications] sync daily failed', e)
      );
    }, 800);
    return () => {
      if (dailySyncRef.current) clearTimeout(dailySyncRef.current);
    };
  }, [dailyNotificationsKey, settingsReady, dailySlotsRef]);
}

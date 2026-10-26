import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Settings, Task } from '../src/types';
import { DEFAULT_SETTINGS, getSettings, getTasks, saveSettings, saveTasks } from '../src/lib/storage';
import { rolloverTasks } from '../src/lib/tasks';
import { runMigrations } from '../src/lib/migrations';
import { disableOverdueReminders, requestPermissions } from '../src/lib/notifications';

interface Deps {
  /** Вызывается с ответом на уведомление при запуске и при возврате в приложение */
  onNotificationOpen: (response: Notifications.NotificationResponse | null | undefined) => void;
  isNative: boolean;
}

export function useAppInit({ onNotificationOpen, isNative }: Deps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);

  const tasksRef = useRef<Task[]>([]);
  const dailySlotsRef = useRef<Settings['dailyNotifications']>([]);
  const initializedRef = useRef(false);

  // Синхронизируем рефы с состоянием
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    dailySlotsRef.current = settings?.dailyNotifications ?? [];
  }, [settings?.dailyNotifications]);

  // Сохраняем задачи при каждом изменении (только после загрузки, чтобы не затереть данные пустым массивом)
  useEffect(() => {
    if (!initializedRef.current) return;
    saveTasks(tasks).catch(() => {});
  }, [tasks]);

  // Сохраняем настройки при каждом изменении (только после загрузки)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (settings) saveSettings(settings).catch(() => {});
  }, [settings]);

  // Начальная загрузка: миграции → данные → rollover → уведомления
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await runMigrations();
        const [t0, s0] = await Promise.all([getTasks(), getSettings()]);
        if (cancelled) return;
        const rolled = rolloverTasks(t0);
        if (rolled !== t0) await saveTasks(rolled);
        initializedRef.current = true;
        setTasks(rolled);
        setSettingsState(s0);

        if (isNative) {
          requestPermissions()
            .then(() => disableOverdueReminders())
            .catch((e) => console.warn('[notifications] init failed', e));

          const response = await Notifications.getLastNotificationResponseAsync();
          if (!cancelled) onNotificationOpen(response);
        }
      } catch {
        if (!cancelled) {
          initializedRef.current = true;
          setTasks([]);
          setSettingsState({ ...DEFAULT_SETTINGS });
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rollover при возврате в приложение + проверка уведомлений
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      setTasks((prev) => {
        const rolled = rolloverTasks(prev);
        if (rolled !== prev) {
          saveTasks(rolled).catch(() => {});
          return rolled;
        }
        return prev;
      });
      if (isNative) {
        Notifications.getLastNotificationResponseAsync()
          .then((response) => onNotificationOpen(response))
          .catch(() => {});
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  return { tasks, setTasks, settings, setSettingsState, tasksRef, dailySlotsRef };
}

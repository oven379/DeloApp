import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings, Task } from '../types';

const TASKS_KEY = 'delo_tasks';
const SETTINGS_KEY = 'delo_settings';

const DEFAULT_DAILY = [
  { enabled: true, hour: 9, minute: 0, text: 'Проверь свои планы на сегодня. Хорошего тебе дня)' },
  { enabled: true, hour: 21, minute: 0, text: 'Проверь свои дела на завтра. Ты молодец!' },
];

const SKIP_DELETE_CONFIRM_DAYS = 3;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  listMode: 'compact',
  headerTabsStyle: 'full',
  skipDeleteConfirmUntil: null,
  dailyNotifications: DEFAULT_DAILY,
  editorFontSize: 15,
};

export async function getTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    return raw ? (JSON.parse(raw) as Task[]) : [];
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings> & Record<string, unknown>) : {};
    const base: Settings = { ...DEFAULT_SETTINGS, ...parsed } as Settings;
    if (!Array.isArray(base.dailyNotifications) || base.dailyNotifications.length < 2) {
      base.dailyNotifications = [...DEFAULT_DAILY];
    }
    // Миграция старого флага skipDeleteConfirm (если когда-то был)
    if ('skipDeleteConfirm' in parsed) {
      base.skipDeleteConfirmUntil = (parsed as any).skipDeleteConfirm
        ? Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000
        : null;
      delete (base as any).skipDeleteConfirm;
      await saveSettings(base);
    }
    return base;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSkipDeleteConfirmUntil() {
  return Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}


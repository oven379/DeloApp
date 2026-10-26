import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings, Task } from '../types';
import {
  DEFAULT_SETTINGS,
  SKIP_DELETE_CONFIRM_DAYS,
  normalizeSettings,
  normalizeTasks,
} from './storageCore';

const TASKS_KEY = 'delo_tasks';
const SETTINGS_KEY = 'delo_settings';

export { DEFAULT_SETTINGS };

export async function getTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const tasks = normalizeTasks(parsed);
    if (raw && JSON.stringify(parsed) !== JSON.stringify(tasks)) {
      await saveTasks(tasks);
    }
    return tasks;
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(normalizeTasks(tasks)));
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const settings = normalizeSettings(parsed);
    if (raw && JSON.stringify(parsed) !== JSON.stringify(settings)) {
      await saveSettings(settings);
    }
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function getSkipDeleteConfirmUntil() {
  return Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)));
}

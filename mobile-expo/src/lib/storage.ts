import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DailyNotificationSlot, DayStr, ListMode, Settings, Task, ThemeSetting } from '../types';

const TASKS_KEY = 'delo_tasks';
const SETTINGS_KEY = 'delo_settings';
const STORAGE_SCHEMA_KEY = 'delo_storage_schema_version';
const CURRENT_SCHEMA_VERSION = 2;

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDayStr(value: unknown): value is DayStr {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeDailySlot(value: unknown, fallback: DailyNotificationSlot): DailyNotificationSlot {
  if (!isRecord(value)) return { ...fallback };
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    hour: typeof value.hour === 'number' && value.hour >= 0 && value.hour <= 23 ? value.hour : fallback.hour,
    minute: typeof value.minute === 'number' && value.minute >= 0 && value.minute <= 59 ? value.minute : fallback.minute,
    text: typeof value.text === 'string' && value.text.trim() ? value.text : fallback.text,
  };
}

function normalizeSettings(raw: unknown): Settings {
  const parsed = isRecord(raw) ? raw : {};
  const theme: ThemeSetting =
    parsed.theme === 'light' || parsed.theme === 'system' || parsed.theme === 'dark' ? parsed.theme : DEFAULT_SETTINGS.theme;
  const listMode: ListMode =
    parsed.listMode === 'expanded' || parsed.listMode === 'compact' ? parsed.listMode : DEFAULT_SETTINGS.listMode;
  const headerTabsStyle: Settings['headerTabsStyle'] =
    parsed.headerTabsStyle === 'short' || parsed.headerTabsStyle === 'full'
      ? parsed.headerTabsStyle
      : DEFAULT_SETTINGS.headerTabsStyle;
  const skipDeleteConfirmUntil = numberOrNull(parsed.skipDeleteConfirmUntil);
  const daily = Array.isArray(parsed.dailyNotifications) ? parsed.dailyNotifications : [];
  const editorFontSize =
    typeof parsed.editorFontSize === 'number' && Number.isFinite(parsed.editorFontSize)
      ? Math.min(24, Math.max(12, parsed.editorFontSize))
      : DEFAULT_SETTINGS.editorFontSize;

  return {
    theme,
    listMode,
    headerTabsStyle,
    skipDeleteConfirmUntil:
      typeof parsed.skipDeleteConfirm === 'boolean'
        ? parsed.skipDeleteConfirm
          ? Date.now() + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000
          : null
        : skipDeleteConfirmUntil,
    dailyNotifications: [
      normalizeDailySlot(daily[0], DEFAULT_DAILY[0]),
      normalizeDailySlot(daily[1], DEFAULT_DAILY[1]),
    ],
    editorFontSize,
  };
}

function normalizeTask(value: unknown, index: number): Task | null {
  if (!isRecord(value)) return null;
  const now = Date.now();
  const text = typeof value.text === 'string' ? value.text : '';
  const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : now;
  const forDay = isDayStr(value.forDay) ? value.forDay : (new Date(createdAt).toISOString().slice(0, 10) as DayStr);
  const subtasks = Array.isArray(value.subtasks)
    ? value.subtasks
        .filter(isRecord)
        .map((subtask, subtaskIndex) => ({
          id: typeof subtask.id === 'string' && subtask.id ? subtask.id : `s_${createdAt}_${subtaskIndex}`,
          text: typeof subtask.text === 'string' ? subtask.text : '',
          done: typeof subtask.done === 'boolean' ? subtask.done : false,
        }))
    : [];

  return {
    id: typeof value.id === 'string' && value.id ? value.id : `t_${createdAt}_${index}`,
    text,
    createdAt,
    updatedAt: numberOrNull(value.updatedAt),
    forDay,
    completedAt: numberOrNull(value.completedAt),
    isOverdue: typeof value.isOverdue === 'boolean' ? value.isOverdue : false,
    originalForDay: isDayStr(value.originalForDay) ? value.originalForDay : undefined,
    order: typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : index,
    reminderAt: numberOrNull(value.reminderAt),
    subtasks,
  };
}

function normalizeTasks(raw: unknown): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeTask).filter((task): task is Task => task !== null);
}

export async function getTasks(): Promise<Task[]> {
  try {
    const raw = await AsyncStorage.getItem(TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const tasks = normalizeTasks(parsed);
    if (raw && JSON.stringify(parsed) !== JSON.stringify(tasks)) {
      await saveTasks(tasks);
    }
    await AsyncStorage.setItem(STORAGE_SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
    return tasks;
  } catch {
    return [];
  }
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(normalizeTasks(tasks)));
  await AsyncStorage.setItem(STORAGE_SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
}

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const settings = normalizeSettings(parsed);
    if (raw && JSON.stringify(parsed) !== JSON.stringify(settings)) {
      await saveSettings(settings);
    }
    await AsyncStorage.setItem(STORAGE_SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
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
  await AsyncStorage.setItem(STORAGE_SCHEMA_KEY, String(CURRENT_SCHEMA_VERSION));
}


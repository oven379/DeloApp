import type { DailyNotificationSlot, DayStr, ListMode, RepeatRule, Settings, Task, ThemeSetting } from '../types';

export const CURRENT_SCHEMA_VERSION = 2;

export const DEFAULT_DAILY: DailyNotificationSlot[] = [
  { enabled: true, hour: 9, minute: 0, text: 'Проверь свои планы на сегодня. Хорошего тебе дня)' },
  { enabled: true, hour: 21, minute: 0, text: 'Проверь свои дела на завтра. Ты молодец!' },
];

export const SKIP_DELETE_CONFIRM_DAYS = 3;

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

function normalizeRepeatRule(value: unknown): RepeatRule {
  return value === 'daily' || value === 'weekdays' || value === 'weekly' ? value : 'none';
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

export function normalizeSettings(raw: unknown, now = Date.now()): Settings {
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
          ? now + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000
          : null
        : skipDeleteConfirmUntil,
    dailyNotifications: [
      normalizeDailySlot(daily[0], DEFAULT_DAILY[0]),
      normalizeDailySlot(daily[1], DEFAULT_DAILY[1]),
    ],
    editorFontSize,
  };
}

function normalizeTask(value: unknown, index: number, now = Date.now()): Task | null {
  if (!isRecord(value)) return null;
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
    focusRank: typeof value.focusRank === 'number' && value.focusRank >= 1 && value.focusRank <= 3 ? Math.floor(value.focusRank) : null,
    repeatRule: normalizeRepeatRule(value.repeatRule),
    repeatSourceId: typeof value.repeatSourceId === 'string' && value.repeatSourceId ? value.repeatSourceId : null,
  };
}

export function normalizeTasks(raw: unknown, now = Date.now()): Task[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value, index) => normalizeTask(value, index, now)).filter((task): task is Task => task !== null);
}

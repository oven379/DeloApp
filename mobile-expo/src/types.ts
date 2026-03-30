export type DayStr = `${number}-${number}-${number}`; // YYYY-MM-DD

export type Task = {
  id: string;
  text: string;
  createdAt: number;
  /** Последнее изменение текста/напоминания (если было) */
  updatedAt?: number | null;
  forDay: DayStr;
  completedAt: number | null;
  isOverdue: boolean;
  originalForDay?: DayStr;
  order?: number;
  reminderAt: number | null;
  subtasks?: { id: string; text: string; done: boolean }[];
};

export type DailyNotificationSlot = {
  enabled: boolean;
  hour: number;
  minute: number;
  text: string;
};

export type ThemeSetting = 'dark' | 'light' | 'system';
export type ListMode = 'compact' | 'expanded';
/** Полные подписи «Сегодня»/«Завтра» или краткие дни недели «пн»/«вт» */
export type HeaderTabsStyle = 'full' | 'short';

export type Settings = {
  theme: ThemeSetting;
  listMode: ListMode;
  headerTabsStyle: HeaderTabsStyle;
  skipDeleteConfirmUntil: number | null;
  dailyNotifications: DailyNotificationSlot[];
  editorFontSize?: number;
};


import type { DayStr, Task } from '../types';

export function dayStrFromDateLocal(date: Date): DayStr {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}` as DayStr;
}

export function todayStr(): DayStr {
  return dayStrFromDateLocal(new Date());
}

export function tomorrowStr(): DayStr {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dayStrFromDateLocal(d);
}

/** 'today' | 'tomorrow' | YYYY-MM-DD → строка даты */
export function getCurrentDayStr(dayView: string): DayStr {
  if (dayView === 'today') return todayStr();
  if (dayView === 'tomorrow') return tomorrowStr();
  if (typeof dayView === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayView)) return dayView as DayStr;
  return todayStr();
}

export function createTask(text: string, order = 0, forDay?: DayStr | null): Task {
  const now = Date.now();
  const day = (forDay || todayStr()) as DayStr;
  return {
    id: `t_${now}_${Math.random().toString(36).slice(2, 9)}`,
    text: text.trim(),
    createdAt: now,
    updatedAt: null,
    forDay: day,
    completedAt: null,
    isOverdue: false,
    order,
    reminderAt: null,
  };
}

/** Переносит невыполненные задачи с прошлых дней на сегодня с пометкой просрочки */
export function rolloverTasks(tasks: Task[]): Task[] {
  const today = todayStr();
  let changed = false;
  const next = tasks.map((t) => {
    if (t.completedAt) return t;
    if (t.forDay < today) {
      changed = true;
      return {
        ...t,
        forDay: today,
        isOverdue: true,
        originalForDay: (t.originalForDay || t.forDay) as DayStr,
      };
    }
    return t;
  });
  return changed ? next : tasks;
}

export function getTodayStats(tasks: Task[]) {
  const today = todayStr();
  const forToday = tasks.filter((t) => t.forDay === today);
  const completed = forToday.filter((t) => t.completedAt != null);
  const overdue = tasks.filter((t) => !t.completedAt && t.isOverdue).length;
  return { total: forToday.length, done: completed.length, overdue };
}

export function getDayStats(tasks: Task[], dayStr: DayStr) {
  const forDay = tasks.filter((t) => t.forDay === dayStr);
  const completed = forDay.filter((t) => t.completedAt != null);
  return { total: forDay.length, done: completed.length, overdue: 0 };
}

export function formatDayStr(dayStr: string) {
  if (!dayStr || dayStr.length < 10) return dayStr;
  const [y, m, d] = dayStr.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

export function formatTaskDate(ts: number) {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} · ${h}:${m}`;
}


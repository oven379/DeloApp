import type { DayStr, Task } from '../types';
import { todayStr } from './tasks';

export type DayView = 'today' | 'tomorrow' | DayStr;

export function isDayStr(x: string): x is DayStr {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}

export function formatHeaderDate(dayView: DayView) {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  if (dayView === 'today') return new Date().toLocaleDateString('ru-RU', opts);
  if (dayView === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString('ru-RU', opts);
  }
  if (isDayStr(dayView)) {
    const [y, m, d] = dayView.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('ru-RU', opts);
  }
  return new Date().toLocaleDateString('ru-RU', opts);
}

export function taskSortKey(t: Task) {
  return t.order ?? 0;
}

export function isPastDayStr(day: DayStr) {
  return day < todayStr();
}

import type { RepeatRule } from '../types';

export function getRepeatLabel(rule: RepeatRule): string {
  if (rule === 'daily') return 'каждый день';
  if (rule === 'weekdays') return 'по будням';
  if (rule === 'weekly') return 'раз в неделю';
  return 'не повторять';
}

/** YYYY-MM-DD → DD.MM.YY */
export function formatDayStr(dayStr: string): string {
  if (!dayStr || dayStr.length < 10) return dayStr;
  const [y, m, d] = dayStr.split('-');
  return `${d}.${m}.${y.slice(2)}`;
}

/** Timestamp → DD.MM.YY · HH:MM (местное время) */
export function formatTaskDate(ts: number): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(2);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} · ${h}:${m}`;
}

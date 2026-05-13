import type { DailyNotificationSlot, Task } from '../types';

export const DAILY_NOTIFICATION_TIMES = [
  { hour: 9, minute: 0, tag: 'daily_morning' },
  { hour: 21, minute: 0, tag: 'daily_evening' },
] as const;

export type DailyNotificationPlan = {
  tag: (typeof DAILY_NOTIFICATION_TIMES)[number]['tag'];
  identifier: string;
  hour: number;
  minute: number;
  body: string;
};

export type TaskReminderPlan = {
  taskId: string;
  reminderAt: number;
  body: string;
};

export function planDailyNotifications(slots: DailyNotificationSlot[] = []): DailyNotificationPlan[] {
  return DAILY_NOTIFICATION_TIMES.flatMap((time, index) => {
    const slot = slots[index];
    if (!slot?.enabled) return [];
    return [
      {
        tag: time.tag,
        identifier: `delo_${time.tag}`,
        hour: time.hour,
        minute: time.minute,
        body: slot.text || (index === 0 ? 'Проверь свои планы на сегодня.' : 'Проверь свои дела на завтра.'),
      },
    ];
  });
}

export function planTaskReminders(tasks: Task[] = [], now = Date.now()): TaskReminderPlan[] {
  return tasks
    .filter((task) => !!task.reminderAt && task.reminderAt > now)
    .map((task) => {
      const taskSummary = (task.text || 'Без названия').trim().slice(0, 80);
      return {
        taskId: task.id,
        reminderAt: task.reminderAt!,
        body: taskSummary ? `Напоминание: ${taskSummary}` : 'Напоминание о деле',
      };
    });
}

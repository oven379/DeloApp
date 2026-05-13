const assert = require('node:assert/strict');
const test = require('node:test');

const {
  planDailyNotifications,
  planTaskReminders,
} = require('../.test-build/src/lib/notificationPlanning');

test('planDailyNotifications keeps product fixed morning and evening times', () => {
  const plans = planDailyNotifications([
    { enabled: true, hour: 7, minute: 10, text: 'Custom morning' },
    { enabled: true, hour: 23, minute: 45, text: 'Custom evening' },
  ]);

  assert.deepEqual(plans.map((p) => [p.tag, p.identifier, p.hour, p.minute, p.body]), [
    ['daily_morning', 'delo_daily_morning', 9, 0, 'Custom morning'],
    ['daily_evening', 'delo_daily_evening', 21, 0, 'Custom evening'],
  ]);
});

test('planDailyNotifications returns one stable request per enabled daily slot', () => {
  const plans = planDailyNotifications([
    { enabled: true, hour: 9, minute: 0, text: 'Morning' },
    { enabled: true, hour: 21, minute: 0, text: 'Evening' },
  ]);

  assert.equal(new Set(plans.map((p) => p.identifier)).size, plans.length);
  assert.equal(plans.length, 2);
});

test('planTaskReminders schedules only future task reminders', () => {
  const now = 1_700_000_000_000;
  const plans = planTaskReminders([
    { id: 'past', text: 'Past', reminderAt: now - 1 },
    { id: 'none', text: 'None', reminderAt: null },
    { id: 'future', text: 'Future task', reminderAt: now + 60_000 },
  ], now);

  assert.deepEqual(plans, [
    { taskId: 'future', reminderAt: now + 60_000, body: 'Напоминание: Future task' },
  ]);
});

test('planTaskReminders trims long reminder bodies', () => {
  const now = 1_700_000_000_000;
  const text = 'A'.repeat(100);
  const [plan] = planTaskReminders([{ id: 'future', text, reminderAt: now + 1 }], now);

  assert.equal(plan.body, `Напоминание: ${'A'.repeat(80)}`);
});

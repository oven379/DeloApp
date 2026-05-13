const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createNextRepeatedTask,
  createTask,
  dayStrFromDateLocal,
  getNextRepeatDay,
  rolloverTasks,
  todayStr,
} = require('../.test-build/src/lib/tasks');

function dayOffset(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return dayStrFromDateLocal(date);
}

test('rolloverTasks moves unfinished past tasks to today and preserves originalForDay', () => {
  const pastDay = dayOffset(-2);
  const task = { ...createTask('Pay invoice', 0, pastDay), isOverdue: false };

  const [rolled] = rolloverTasks([task]);

  assert.equal(rolled.forDay, todayStr());
  assert.equal(rolled.isOverdue, true);
  assert.equal(rolled.originalForDay, pastDay);
});

test('rolloverTasks keeps first originalForDay across repeated rollovers', () => {
  const originalForDay = dayOffset(-5);
  const task = {
    ...createTask('Call client', 0, dayOffset(-1)),
    isOverdue: true,
    originalForDay,
  };

  const [rolled] = rolloverTasks([task]);

  assert.equal(rolled.forDay, todayStr());
  assert.equal(rolled.originalForDay, originalForDay);
});

test('rolloverTasks does not move completed past tasks', () => {
  const pastDay = dayOffset(-1);
  const task = { ...createTask('Done', 0, pastDay), completedAt: Date.now() };

  const result = rolloverTasks([task]);

  assert.equal(result, result);
  assert.equal(result[0].forDay, pastDay);
  assert.equal(result[0].isOverdue, false);
});

test('getNextRepeatDay skips weekends for weekday tasks', () => {
  const fridayTask = { ...createTask('Workday', 0, '2026-05-15'), repeatRule: 'weekdays' };

  assert.equal(getNextRepeatDay(fridayTask), '2026-05-18');
});

test('createNextRepeatedTask copies reminder time and resets completion/focus', () => {
  const task = {
    ...createTask('Repeat me', 0, '2026-05-13'),
    repeatRule: 'daily',
    repeatSourceId: 'series-1',
    completedAt: 123,
    focusRank: 1,
    reminderAt: new Date(2026, 4, 13, 9, 30).getTime(),
  };

  const next = createNextRepeatedTask(task, Date.UTC(2026, 4, 13, 12));

  assert.equal(next.forDay, '2026-05-14');
  assert.equal(next.completedAt, null);
  assert.equal(next.focusRank, null);
  assert.equal(next.repeatSourceId, 'series-1');
  assert.equal(new Date(next.reminderAt).getHours(), 9);
  assert.equal(new Date(next.reminderAt).getMinutes(), 30);
});

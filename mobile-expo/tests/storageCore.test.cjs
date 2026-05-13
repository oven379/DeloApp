const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SETTINGS,
  SKIP_DELETE_CONFIRM_DAYS,
  normalizeSettings,
  normalizeTasks,
} = require('../.test-build/src/lib/storageCore');

test('normalizeSettings migrates old skipDeleteConfirm flag to an expiry timestamp', () => {
  const now = 1_700_000_000_000;
  const settings = normalizeSettings({ skipDeleteConfirm: true }, now);

  assert.equal(settings.skipDeleteConfirmUntil, now + SKIP_DELETE_CONFIRM_DAYS * 24 * 60 * 60 * 1000);
});

test('normalizeSettings clamps invalid values and fills daily notification defaults', () => {
  const settings = normalizeSettings({
    theme: 'neon',
    listMode: 'wide',
    headerTabsStyle: 'tiny',
    editorFontSize: 99,
    dailyNotifications: [
      { enabled: 'yes', hour: 100, minute: -1, text: '' },
      { enabled: false, hour: 20, minute: 30, text: 'Evening' },
    ],
  });

  assert.equal(settings.theme, DEFAULT_SETTINGS.theme);
  assert.equal(settings.listMode, DEFAULT_SETTINGS.listMode);
  assert.equal(settings.headerTabsStyle, DEFAULT_SETTINGS.headerTabsStyle);
  assert.equal(settings.editorFontSize, 24);
  assert.deepEqual(settings.dailyNotifications[0], DEFAULT_SETTINGS.dailyNotifications[0]);
  assert.deepEqual(settings.dailyNotifications[1], { enabled: false, hour: 20, minute: 30, text: 'Evening' });
});

test('normalizeTasks removes malformed entries and normalizes task fields', () => {
  const now = Date.UTC(2026, 0, 15);
  const tasks = normalizeTasks([
    null,
    {
      id: '',
      text: 42,
      createdAt: now,
      forDay: 'bad-date',
      completedAt: 'nope',
      isOverdue: 'yes',
      order: Number.NaN,
      reminderAt: 123,
      subtasks: [{ text: 'Subtask', done: true }],
    },
  ], now);

  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].id, `t_${now}_1`);
  assert.equal(tasks[0].text, '');
  assert.equal(tasks[0].forDay, '2026-01-15');
  assert.equal(tasks[0].completedAt, null);
  assert.equal(tasks[0].isOverdue, false);
  assert.equal(tasks[0].order, 1);
  assert.equal(tasks[0].reminderAt, 123);
  assert.deepEqual(tasks[0].subtasks, [{ id: `s_${now}_0`, text: 'Subtask', done: true }]);
});

/**
 * Пошаговые миграции хранилища.
 *
 * Каждая запись описывает переход от версии (index) к следующей.
 * Добавляя новую миграцию: дополни массив MIGRATIONS и подними CURRENT_SCHEMA_VERSION
 * в storageCore.ts.
 *
 * Миграции применяются один раз: версия читается из AsyncStorage,
 * прогоняются только шаги от текущей до целевой, затем версия записывается обратно.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENT_SCHEMA_VERSION } from './storageCore';

const SCHEMA_VERSION_KEY = 'delo_storage_schema_version';

type MigrationFn = (raw: {
  tasks: unknown[];
  settings: Record<string, unknown>;
}) => { tasks: unknown[]; settings: Record<string, unknown> };

/**
 * Массив миграций. Индекс i описывает переход с версии i на i+1.
 * migrations[0] = v0 → v1
 * migrations[1] = v1 → v2
 * migrations[2] = v2 → v3
 * ...
 */
const MIGRATIONS: MigrationFn[] = [
  // v0 → v1: начальная версия, данные уже нормализованы normalizeTask/normalizeSettings
  (data) => data,

  // v1 → v2: переименование skipDeleteConfirm (boolean) → skipDeleteConfirmUntil (timestamp)
  // Обрабатывается в normalizeSettings как fallback, но здесь явно чистим старое поле
  ({ tasks, settings }) => {
    const next = { ...settings };
    if (typeof next.skipDeleteConfirm === 'boolean') {
      if (next.skipDeleteConfirm && !next.skipDeleteConfirmUntil) {
        next.skipDeleteConfirmUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
      }
      delete next.skipDeleteConfirm;
    }
    return { tasks, settings: next };
  },

  // v2 → v3: исправление UTC-смещения в forDay для задач без валидной даты
  // (задачи, созданные вблизи полуночи в UTC+N могли получить «вчерашнюю» дату)
  ({ tasks, settings }) => {
    const fixed = tasks.map((t: any) => {
      if (!t || typeof t !== 'object') return t;
      // Пересчитываем forDay из createdAt через локальное время только если
      // поле выглядит как ISO-дата и есть createdAt для проверки
      if (
        typeof t.forDay === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(t.forDay) &&
        typeof t.createdAt === 'number'
      ) {
        const d = new Date(t.createdAt);
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // Корректируем только если расхождение ровно 1 день (UTC-сдвиг) и задача не просроченная
        const storedDate = new Date(t.forDay).getTime();
        const localDate = new Date(local).getTime();
        const diffDays = Math.abs(storedDate - localDate) / 86400000;
        if (diffDays === 1 && !t.isOverdue && !t.completedAt) {
          return { ...t, forDay: local };
        }
      }
      return t;
    });
    return { tasks: fixed, settings };
  },
];

/**
 * Запускает все pending-миграции.
 * Вызывается один раз при старте приложения — до getTasks/getSettings.
 */
export async function runMigrations(): Promise<void> {
  try {
    const storedStr = await AsyncStorage.getItem(SCHEMA_VERSION_KEY);
    const storedVersion = storedStr ? parseInt(storedStr, 10) : 0;

    if (storedVersion >= CURRENT_SCHEMA_VERSION) return;

    const [rawTasks, rawSettings] = await Promise.all([
      AsyncStorage.getItem('delo_tasks'),
      AsyncStorage.getItem('delo_settings'),
    ]);

    let data = {
      tasks: rawTasks ? (JSON.parse(rawTasks) as unknown[]) : [],
      settings: rawSettings ? (JSON.parse(rawSettings) as Record<string, unknown>) : {},
    };

    for (let v = storedVersion; v < CURRENT_SCHEMA_VERSION; v++) {
      const migrate = MIGRATIONS[v];
      if (migrate) data = migrate(data);
    }

    await Promise.all([
      AsyncStorage.setItem('delo_tasks', JSON.stringify(data.tasks)),
      AsyncStorage.setItem('delo_settings', JSON.stringify(data.settings)),
      AsyncStorage.setItem(SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION)),
    ]);
  } catch (e) {
    console.warn('[migrations] failed, skipping:', e);
  }
}

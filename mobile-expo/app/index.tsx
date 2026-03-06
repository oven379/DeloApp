import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { CalendarList } from 'react-native-calendars';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import type { DayStr, Settings, Task } from '../src/types';
import { getSettings, getSkipDeleteConfirmUntil, getTasks, saveSettings, saveTasks } from '../src/lib/storage';
import { createTask, getCurrentDayStr, getDayStats, getTodayStats, rolloverTasks, todayStr, tomorrowStr } from '../src/lib/tasks';
import { requestPermissions, syncDailyNotifications, syncOverdueReminder, syncTaskReminders } from '../src/lib/notifications';

type DayView = 'today' | 'tomorrow' | DayStr;

function isDayStr(x: string): x is DayStr {
  return /^\d{4}-\d{2}-\d{2}$/.test(x);
}

function formatHeaderDate(dayView: DayView) {
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

function useResolvedTheme(theme: Settings['theme']) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return system ?? 'dark';
}

function taskSortKey(t: Task) {
  return t.order ?? 0;
}

export default function DeloScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [dayView, setDayView] = useState<DayView>('today');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [reminderTemp, setReminderTemp] = useState<Date>(new Date());
  const [reminderAndroidMode, setReminderAndroidMode] = useState<'date' | 'time'>('date');
  const [dailyTimePickerIdx, setDailyTimePickerIdx] = useState<number | null>(null);
  const [dailyTimeTemp, setDailyTimeTemp] = useState<Date>(new Date());
  const [postponeModalTaskId, setPostponeModalTaskId] = useState<string | null>(null);
  const [reminderNotifications, setReminderNotifications] = useState<
    { id: string; taskId: string | null; text: string; firedAt: number }[]
  >([]);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [dontAskDeleteAgain, setDontAskDeleteAgain] = useState(false);

  const addInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t0, s0] = await Promise.all([getTasks(), getSettings()]);
      if (cancelled) return;
      const rolled = rolloverTasks(t0);
      if (rolled !== t0) await saveTasks(rolled);
      setTasks(rolled);
      setSettingsState(s0);

      // Попросим разрешение и синхронизируем напоминания при первом запуске.
      requestPermissions()
        .then(() => Promise.all([syncTaskReminders(rolled), syncDailyNotifications(s0.dailyNotifications), syncOverdueReminder(rolled)]))
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedTheme = useResolvedTheme(settings?.theme ?? 'dark');
  const colors = resolvedTheme === 'dark' ? DARK : LIGHT;

  useEffect(() => {
    if (!settings) return;
    saveSettings(settings).catch(() => {});
  }, [settings]);

  useEffect(() => {
    saveTasks(tasks).catch(() => {});
  }, [tasks]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      // При возвращении в приложение — очистим бейдж и пересинхронизируем напоминания (после перезагрузки/обновлений).
      Notifications.setBadgeCountAsync(0).catch(() => {});
      setTasks((prev) => {
        const rolled = rolloverTasks(prev);
        if (rolled !== prev) {
          saveTasks(rolled).catch(() => {});
          return rolled;
        }
        return prev;
      });
    });
    return () => sub.remove();
  }, []);

  // Лисенеры уведомлений: пополняем список "Уведомления" внутри приложения.
  useEffect(() => {
    const sub1 = Notifications.addNotificationReceivedListener((n) => {
      const now = Date.now();
      const text = n.request.content.body || 'Напоминание';
      const taskId = (n.request.content.data as any)?.taskId ?? null;
      setReminderNotifications((prev) => [
        ...prev,
        { id: `rem_${taskId ?? 'x'}_${now}_${prev.length}`, taskId, text, firedAt: now },
      ]);
      Notifications.getBadgeCountAsync()
        .then((c) => Notifications.setBadgeCountAsync((c ?? 0) + 1))
        .catch(() => {});
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((r) => {
      const now = Date.now();
      const text = r.notification.request.content.body || 'Напоминание';
      const taskId = (r.notification.request.content.data as any)?.taskId ?? null;
      setReminderNotifications((prev) => [
        ...prev,
        { id: `rem_${taskId ?? 'x'}_${now}_${prev.length}`, taskId, text, firedAt: now },
      ]);
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // Дебаунс синхронизации напоминаний при изменениях задач.
  const syncTasksRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!settings) return;
    if (syncTasksRef.current) clearTimeout(syncTasksRef.current);
    syncTasksRef.current = setTimeout(() => {
      syncTaskReminders(tasks).catch(() => {});
      syncOverdueReminder(tasks).catch(() => {});
    }, 350);
    return () => {
      if (syncTasksRef.current) clearTimeout(syncTasksRef.current);
    };
  }, [tasks, settings]);

  useEffect(() => {
    if (!settings) return;
    syncDailyNotifications(settings.dailyNotifications).catch(() => {});
  }, [settings?.dailyNotifications, settings]);

  const currentDayStr = getCurrentDayStr(dayView);
  const stats = dayView === 'today' ? getTodayStats(tasks) : getDayStats(tasks, currentDayStr);
  const headerDateLabel = formatHeaderDate(dayView);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    const now = Date.now();
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const in7 = new Date(today0);
    in7.setDate(in7.getDate() + 7);
    in7.setHours(23, 59, 59, 999);

    for (const t of tasks) {
      if (!t.forDay) continue;
      if (!marks[t.forDay]) marks[t.forDay] = { marked: true, dots: [] as any[] };
      // базовая точка "есть дела"
      marks[t.forDay].dots.push({ key: `task_${t.id}`, color: colors.muted });
    }
    for (const t of tasks) {
      if (!t.reminderAt || t.reminderAt <= now) continue;
      const d = new Date(t.reminderAt);
      const ds = d.toISOString().slice(0, 10);
      if (!marks[ds]) marks[ds] = { marked: true, dots: [] as any[] };
      const isSoon = d.getTime() <= in7.getTime();
      marks[ds].dots.push({ key: `rem_${t.id}`, color: isSoon ? '#ef4444' : '#22c55e' });
    }
    // выбранный день
    marks[currentDayStr] = {
      ...(marks[currentDayStr] || {}),
      selected: true,
      selectedColor: colors.accent,
    };
    return marks;
  }, [tasks, currentDayStr, colors.accent, colors.muted]);

  const { incomplete, completed } = useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    const filter = q
      ? (list: Task[]) => list.filter((t) => (t.text || '').toLowerCase().includes(q))
      : (list: Task[]) => list;

    const forDay = tasks.filter((t) => t.forDay === currentDayStr);
    const allInc = forDay.filter((t) => !t.completedAt).sort((a, b) => taskSortKey(a) - taskSortKey(b));
    const done = forDay.filter((t) => t.completedAt).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    return { incomplete: filter(allInc), completed: filter(done) };
  }, [tasks, currentDayStr, searchQuery]);

  const addTask = (text: string, forDay?: DayStr) => {
    const day = forDay ?? currentDayStr;
    setTasks((prev) => {
      const forThatDay = prev.filter((t) => t.forDay === day);
      const maxOrder = forThatDay.length === 0 ? 0 : Math.max(0, ...forThatDay.map((t) => t.order ?? 0));
      return [...prev, createTask(text, maxOrder + 1, day)];
    });
  };

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              completedAt: t.completedAt ? null : Date.now(),
              isOverdue: false,
              forDay: todayStr(),
            }
          : t
      )
    );
  };

  const updateTask = (id: string, text: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text: text.trim(), isOverdue: false } : t)));
  };

  const deleteTask = (id: string) => {
    const skip = !!(settings?.skipDeleteConfirmUntil && Date.now() < settings.skipDeleteConfirmUntil);
    if (!skip) {
      setDontAskDeleteAgain(false);
      setConfirmDeleteTaskId(id);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const confirmDelete = () => {
    if (!confirmDeleteTaskId) return;
    const id = confirmDeleteTaskId;
    setConfirmDeleteTaskId(null);
    if (dontAskDeleteAgain) {
      setSettingsState((s) => (s ? { ...s, skipDeleteConfirmUntil: getSkipDeleteConfirmUntil() } : s));
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const postponeToTomorrow = (id: string) => {
    const tomorrow = tomorrowStr();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, forDay: tomorrow, isOverdue: false } : t)));
  };

  const hasReminderForTodayNotFired = (task: Task) => {
    if (!task.reminderAt) return false;
    const now = Date.now();
    if (task.reminderAt <= now) return false;
    const rd = new Date(task.reminderAt);
    const td = new Date();
    return (
      rd.getDate() === td.getDate() &&
      rd.getMonth() === td.getMonth() &&
      rd.getFullYear() === td.getFullYear()
    );
  };

  const handlePostponePress = (task: Task) => {
    if (hasReminderForTodayNotFired(task)) {
      setPostponeModalTaskId(task.id);
      return;
    }
    postponeToTomorrow(task.id);
  };

  const setTaskReminder = (id: string, reminderAt: number | null) => {
    const today = todayStr();
    const tomorrow = tomorrowStr();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next: Task = { ...t, reminderAt: reminderAt || null };
        if (reminderAt) {
          const reminderDateStr = new Date(reminderAt).toISOString().slice(0, 10) as DayStr;
          if (reminderDateStr !== today && reminderDateStr !== tomorrow) {
            next.forDay = reminderDateStr;
          }
        }
        return next;
      })
    );
  };

  const reorderTasks = (fromIndex: number, toIndex: number, forDay: DayStr) => {
    setTasks((prev) => {
      const forDayIncomplete = prev.filter((t) => t.forDay === forDay && !t.completedAt);
      const completedSameDay = prev.filter((t) => t.forDay === forDay && t.completedAt);
      const rest = prev.filter((t) => t.forDay !== forDay);
      const list = [...forDayIncomplete].sort((a, b) => taskSortKey(a) - taskSortKey(b));
      const [removed] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, removed);
      const reordered = list.map((t, i) => ({ ...t, order: i }));
      return [...reordered, ...completedSameDay, ...rest];
    });
  };

  const onExport = async () => {
    try {
      const payload = JSON.stringify({ tasks, exportedAt: new Date().toISOString() }, null, 2);
      const out = new File(Paths.cache, `delo-backup-${todayStr()}.json`);
      out.create({ overwrite: true });
      out.write(payload);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { mimeType: 'application/json' });
    } catch {}
  };

  const onImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json'], copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file?.uri) return;
      const raw = await new File(file.uri).text();
      const json = JSON.parse(raw);
      const list: unknown = Array.isArray(json?.tasks) ? json.tasks : (Array.isArray(json) ? json : []);
      if (Array.isArray(list) && list.length >= 0) {
        // минимальная валидация
        const ok = list.every((t) => t && typeof t.id === 'string' && typeof t.text === 'string');
        if (ok) setTasks(list as Task[]);
      }
    } catch {}
  };

  const editingTask = tasks.find((t) => t.id === editingTaskId) || null;
  const postponeTask = tasks.find((t) => t.id === postponeModalTaskId) || null;

  useEffect(() => {
    if (editingTaskId) {
      setEditDraft(editingTask?.text ?? '');
      if (editingTask?.reminderAt) setReminderTemp(new Date(editingTask.reminderAt));
    } else {
      setEditDraft('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTaskId]);

  if (!settings) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <Text style={{ color: colors.text }}>Загрузка…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Дело</Text>
              <Text style={[styles.subtitle, { color: colors.muted }]}>{headerDateLabel}</Text>
            </View>
            <View style={styles.headerActions}>
              <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
                <Pressable
                  onPress={() => setDayView('today')}
                  style={[styles.tab, dayView === 'today' && { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Сегодня</Text>
                </Pressable>
                <Pressable
                  onPress={() => setDayView('tomorrow')}
                  style={[styles.tab, dayView === 'tomorrow' && { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Завтра</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setCalendarOpen(true)} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>📅</Text>
              </Pressable>
              <Pressable onPress={() => setSettingsOpen(true)} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text }}>⚙️</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: colors.muted }]}>
              {stats.total ? `${stats.done}/${stats.total}` : '0/0'}
              {stats.total - stats.done > 0 ? ` · ${stats.total - stats.done} осталось` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={[styles.searchWrap, { backgroundColor: colors.bg }]}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск по делам…"
              placeholderTextColor={colors.muted}
              style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]}
            />
          </View>

          <DraggableFlatList
            data={incomplete}
            keyExtractor={(item) => item.id}
            onDragEnd={({ from, to }) => reorderTasks(from, to, currentDayStr)}
            renderItem={({ item, drag, isActive }: RenderItemParams<Task>) => (
              <Pressable
                onLongPress={drag}
                onPress={() => setEditingTaskId(item.id)}
                style={[
                  styles.taskRow,
                  settings.listMode === 'compact' ? styles.taskRowCompact : styles.taskRowExpanded,
                  {
                    backgroundColor: colors.surface,
                    borderColor: item.isOverdue && !item.completedAt ? colors.overdue : colors.border,
                    opacity: isActive ? 0.7 : 1,
                  },
                ]}>
                <Pressable onPress={() => toggleTask(item.id)} style={[styles.check, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{item.completedAt ? '✓' : ''}</Text>
                </Pressable>
                <View style={styles.taskTextCol}>
                  <Text style={[styles.taskText, { color: colors.text }]} numberOfLines={3}>
                    {item.text}
                  </Text>
                  {!!item.reminderAt && item.reminderAt > Date.now() && (
                    <Text style={[styles.taskMeta, { color: colors.muted }]}>
                      ⏰ {new Date(item.reminderAt).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </Text>
                  )}
                </View>
                {dayView === 'today' && currentDayStr === todayStr() && (
                  <Pressable onPress={() => handlePostponePress(item)} style={styles.smallBtn}>
                    <Text style={{ color: colors.muted }}>→</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => deleteTask(item.id)} style={styles.smallBtn}>
                  <Text style={{ color: colors.muted }}>🗑️</Text>
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>
                  {searchQuery.trim()
                    ? 'По запросу ничего не найдено'
                    : dayView === 'tomorrow'
                      ? 'Пока нет дел на завтра'
                      : isDayStr(dayView)
                        ? `Нет дел на ${dayView}`
                        : 'Нет дел на сегодня'}
                </Text>
                <Text style={[styles.emptyHint, { color: colors.muted }]}>
                  {searchQuery.trim() ? 'Измените запрос или очистите поле поиска.' : 'Добавьте первое дело в поле внизу экрана.'}
                </Text>
                {!searchQuery.trim() && (
                  <Pressable
                    onPress={() => addInputRef.current?.focus()}
                    style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: '#fff' }}>Создать дело</Text>
                  </Pressable>
                )}
              </View>
            }
          />

          {completed.length > 0 && (
            <View style={styles.doneWrap}>
              <Text style={[styles.doneTitle, { color: colors.muted }]}>Готово</Text>
              {completed.map((t) => (
                <View
                  key={t.id}
                  style={[styles.taskRow, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.75 }]}>
                  <Pressable onPress={() => toggleTask(t.id)} style={[styles.check, { borderColor: colors.border }]}>
                    <Text style={{ color: colors.text }}>✓</Text>
                  </Pressable>
                  <Text style={[styles.taskText, { color: colors.text, textDecorationLine: 'line-through', flex: 1 }]} numberOfLines={2}>
                    {t.text}
                  </Text>
                  <Pressable onPress={() => deleteTask(t.id)} style={styles.smallBtn}>
                    <Text style={{ color: colors.muted }}>🗑️</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
          <TextInput
            ref={addInputRef}
            value={newTaskText}
            onChangeText={setNewTaskText}
            placeholder={
              dayView === 'tomorrow'
                ? 'Добавить дело на завтра…'
                : isDayStr(dayView)
                  ? 'Добавить дело на выбранный день…'
                  : 'Добавить дело…'
            }
            placeholderTextColor={colors.muted}
            style={[styles.addInput, { backgroundColor: colors.surface, color: colors.text }]}
            onSubmitEditing={(e) => {
              const v = e.nativeEvent.text?.trim();
              if (!v) return;
              addTask(v);
              setNewTaskText('');
            }}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => {
              const v = newTaskText.trim();
              if (!v) return;
              addTask(v);
              setNewTaskText('');
            }}>
            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>

        {/* Calendar modal */}
        <Modal visible={calendarOpen} animationType="slide" transparent onRequestClose={() => setCalendarOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Планы на день</Text>
                <Pressable onPress={() => setCalendarOpen(false)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <CalendarList
                pastScrollRange={0}
                futureScrollRange={36}
                onDayPress={(d) => {
                  const ds = d.dateString as DayStr;
                  setDayView(ds);
                  setCalendarOpen(false);
                }}
                markingType="multi-dot"
                markedDates={markedDates}
                theme={{
                  calendarBackground: colors.bg,
                  dayTextColor: colors.text,
                  monthTextColor: colors.text,
                  textDisabledColor: colors.muted,
                  selectedDayBackgroundColor: colors.accent,
                  selectedDayTextColor: '#fff',
                  todayTextColor: colors.accent,
                  arrowColor: colors.text,
                }}
              />
            </View>
          </View>
        </Modal>

        {/* Settings modal */}
        <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Настройки</Text>
                <Pressable onPress={() => setSettingsOpen(false)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 0 }]}>Уведомления</Text>
                {reminderNotifications.length === 0 ? (
                  <Text style={{ color: colors.muted }}>Здесь будут ваши напоминания.</Text>
                ) : (
                  <>
                    {reminderNotifications.slice(-8).reverse().map((n) => (
                      <View key={n.id} style={[styles.slotRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2}>
                          {n.text}
                        </Text>
                        <Text style={{ color: colors.muted }}>
                          {new Date(n.firedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    ))}
                    <Pressable onPress={() => setReminderNotifications([])} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                      <Text style={{ color: colors.text }}>Очистить</Text>
                    </Pressable>
                  </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.muted }]}>Тема</Text>
                <View style={styles.row}>
                  {(['light', 'dark', 'system'] as const).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setSettingsState((s) => (s ? { ...s, theme: t } : s))}
                      style={[
                        styles.chip,
                        { backgroundColor: settings.theme === t ? colors.surface2 : colors.surface },
                      ]}>
                      <Text style={{ color: colors.text }}>{t === 'light' ? 'Светлая' : t === 'dark' ? 'Тёмная' : 'Моя'}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.sectionTitle, { color: colors.muted }]}>Режим списка</Text>
                <View style={styles.row}>
                  {(['compact', 'expanded'] as const).map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setSettingsState((s) => (s ? { ...s, listMode: m } : s))}
                      style={[
                        styles.chip,
                        { backgroundColor: settings.listMode === m ? colors.surface2 : colors.surface },
                      ]}>
                      <Text style={{ color: colors.text }}>{m === 'compact' ? 'Компактный' : 'Развёрнутый'}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.sectionTitle, { color: colors.muted }]}>Ежедневные уведомления</Text>
                {(settings.dailyNotifications || []).slice(0, 2).map((slot, idx) => (
                  <View key={idx} style={[styles.slotRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>{idx === 0 ? 'Утро' : 'Вечер'}</Text>
                    <Text style={{ color: colors.muted }}>{String(slot.hour).padStart(2, '0')}:{String(slot.minute).padStart(2, '0')}</Text>
                    <Pressable
                      onPress={() => {
                        const d = new Date();
                        d.setHours(slot.hour ?? 9, slot.minute ?? 0, 0, 0);
                        setDailyTimeTemp(d);
                        setDailyTimePickerIdx(idx);
                      }}
                      style={[styles.chip, { backgroundColor: colors.surface2 }]}>
                      <Text style={{ color: colors.text }}>Время</Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        setSettingsState((s) => {
                          if (!s) return s;
                          const next = [...s.dailyNotifications];
                          next[idx] = { ...next[idx], enabled: !(slot.enabled !== false) };
                          return { ...s, dailyNotifications: next };
                        })
                      }
                      style={[styles.chip, { backgroundColor: slot.enabled !== false ? colors.surface2 : colors.surface }]}>
                      <Text style={{ color: colors.text }}>{slot.enabled !== false ? 'Вкл' : 'Выкл'}</Text>
                    </Pressable>
                  </View>
                ))}

                {dailyTimePickerIdx != null && (
                  <View style={{ marginTop: 6 }}>
                    <DateTimePicker
                      value={dailyTimeTemp}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        if (Platform.OS === 'android') {
                          if (event.type === 'dismissed') {
                            setDailyTimePickerIdx(null);
                            return;
                          }
                        }
                        if (date) setDailyTimeTemp(date);
                        if (Platform.OS === 'android') {
                          const hh = (date ?? dailyTimeTemp).getHours();
                          const mm = (date ?? dailyTimeTemp).getMinutes();
                          const idx = dailyTimePickerIdx;
                          setSettingsState((s) => {
                            if (!s) return s;
                            const next = [...s.dailyNotifications];
                            next[idx] = { ...next[idx], hour: hh, minute: mm };
                            return { ...s, dailyNotifications: next };
                          });
                          setDailyTimePickerIdx(null);
                        }
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <View style={[styles.row, { marginTop: 10 }]}>
                        <Pressable
                          onPress={() => {
                            const hh = dailyTimeTemp.getHours();
                            const mm = dailyTimeTemp.getMinutes();
                            const idx = dailyTimePickerIdx;
                            setSettingsState((s) => {
                              if (!s) return s;
                              const next = [...s.dailyNotifications];
                              next[idx] = { ...next[idx], hour: hh, minute: mm };
                              return { ...s, dailyNotifications: next };
                            });
                            setDailyTimePickerIdx(null);
                          }}
                          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                          <Text style={{ color: '#fff' }}>Готово</Text>
                        </Pressable>
                        <Pressable onPress={() => setDailyTimePickerIdx(null)} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                          <Text style={{ color: colors.text }}>Отмена</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}

                <Pressable onPress={() => setImportExportOpen(true)} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Импорт / Экспорт</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL('https://delodelai.ru').catch(() => {})}
                  style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Поддержка: delodelai.ru</Text>
                </Pressable>
                <Text style={{ color: colors.muted, marginTop: 12 }}>Версия 1.0.0</Text>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Import/export modal */}
        <Modal visible={importExportOpen} animationType="slide" transparent onRequestClose={() => setImportExportOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Импорт / Экспорт</Text>
                <Pressable onPress={() => setImportExportOpen(false)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <View style={{ gap: 12 }}>
                <Pressable onPress={onExport} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: '#fff' }}>Экспортировать JSON</Text>
                </Pressable>
                <Pressable onPress={onImport} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Импортировать JSON</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit task modal */}
        <Modal visible={!!editingTaskId} animationType="slide" transparent onRequestClose={() => setEditingTaskId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Редактировать</Text>
                <Pressable onPress={() => setEditingTaskId(null)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                style={[styles.editInput, { backgroundColor: colors.surface, color: colors.text }]}
              />
              <View style={{ marginTop: 12, gap: 10 }}>
                <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 0 }]}>Напоминание</Text>
                {!!editingTask?.reminderAt && editingTask.reminderAt > Date.now() ? (
                  <Text style={{ color: colors.muted }}>
                    ⏰ {new Date(editingTask.reminderAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                ) : (
                  <Text style={{ color: colors.muted }}>Нет напоминания</Text>
                )}
                <View style={styles.row}>
                  {[
                    { label: 'Сегодня 09:00', day: 0, h: 9, m: 0 },
                    { label: 'Сегодня 13:00', day: 0, h: 13, m: 0 },
                    { label: 'Сегодня 15:00', day: 0, h: 15, m: 0 },
                    { label: 'Завтра 09:00', day: 1, h: 9, m: 0 },
                  ].map((p) => (
                    <Pressable
                      key={p.label}
                      onPress={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + p.day);
                        d.setHours(p.h, p.m, 0, 0);
                        if (d.getTime() <= Date.now()) d.setMinutes(d.getMinutes() + 1);
                        setTaskReminder(editingTaskId!, d.getTime());
                      }}
                      style={[styles.chip, { backgroundColor: colors.surface }]}>
                      <Text style={{ color: colors.text }}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.row}>
                  <Pressable
                    onPress={() => {
                      const base = editingTask?.reminderAt ? new Date(editingTask.reminderAt) : new Date();
                      const d = new Date(base);
                      if (!editingTask?.reminderAt) d.setMinutes(d.getMinutes() + 10);
                      setReminderTemp(d);
                      setReminderPickerOpen(true);
                      setReminderAndroidMode('date');
                    }}
                    style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                    <Text style={{ color: colors.text }}>Выбрать дату/время…</Text>
                  </Pressable>
                  {!!editingTask?.reminderAt && (
                    <Pressable
                      onPress={() => setTaskReminder(editingTaskId!, null)}
                      style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                      <Text style={{ color: colors.text }}>Убрать</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Custom reminder picker */}
              {reminderPickerOpen && Platform.OS === 'ios' && (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker
                    value={reminderTemp}
                    mode="datetime"
                    display="spinner"
                    onChange={(_, date) => {
                      if (date) setReminderTemp(date);
                    }}
                  />
                  <View style={[styles.row, { marginTop: 10 }]}>
                    <Pressable
                      onPress={() => {
                        const ts = reminderTemp.getTime();
                        setReminderPickerOpen(false);
                        if (ts > Date.now()) setTaskReminder(editingTaskId!, ts);
                      }}
                      style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                      <Text style={{ color: '#fff' }}>Поставить</Text>
                    </Pressable>
                    <Pressable onPress={() => setReminderPickerOpen(false)} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                      <Text style={{ color: colors.text }}>Отмена</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {reminderPickerOpen && Platform.OS === 'android' && (
                <View style={{ marginTop: 10 }}>
                  <DateTimePicker
                    value={reminderTemp}
                    mode={reminderAndroidMode}
                    display="default"
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (event.type === 'dismissed') {
                        setReminderPickerOpen(false);
                        return;
                      }
                      if (date) setReminderTemp(date);
                      if (reminderAndroidMode === 'date') {
                        setReminderAndroidMode('time');
                      } else {
                        const ts = (date ?? reminderTemp).getTime();
                        setReminderPickerOpen(false);
                        if (ts > Date.now()) setTaskReminder(editingTaskId!, ts);
                        setReminderAndroidMode('date');
                      }
                    }}
                  />
                </View>
              )}

              <View style={styles.row}>
                <Pressable
                  onPress={() => {
                    updateTask(editingTaskId!, editDraft);
                    setEditingTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: '#fff' }}>Сохранить</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setEditingTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Отмена</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delete confirm */}
        <Modal visible={!!confirmDeleteTaskId} animationType="fade" transparent onRequestClose={() => setConfirmDeleteTaskId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Удалить дело?</Text>
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                Подтвердите удаление. Можно отключить подтверждение на 3 дня.
              </Text>
              <Pressable onPress={() => setDontAskDeleteAgain((v) => !v)} style={{ marginTop: 12 }}>
                <Text style={{ color: colors.text }}>{dontAskDeleteAgain ? '☑' : '☐'} Не спрашивать 3 дня</Text>
              </Pressable>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Pressable onPress={() => setConfirmDeleteTaskId(null)} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Отмена</Text>
                </Pressable>
                <Pressable onPress={confirmDelete} style={[styles.primaryBtn, { backgroundColor: colors.overdue }]}>
                  <Text style={{ color: '#fff' }}>Удалить</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Postpone warning (if reminder today not fired) */}
        <Modal visible={!!postponeModalTaskId} animationType="fade" transparent onRequestClose={() => setPostponeModalTaskId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>У дела есть напоминание сегодня</Text>
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                Если перенести дело на завтра, что сделать с напоминанием?
              </Text>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Pressable
                  onPress={() => {
                    if (postponeTask) postponeToTomorrow(postponeTask.id);
                    setPostponeModalTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>Только дело</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (postponeTask) {
                      postponeToTomorrow(postponeTask.id);
                      const ts = postponeTask.reminderAt;
                      if (ts) {
                        const d = new Date(ts);
                        d.setDate(d.getDate() + 1);
                        setTaskReminder(postponeTask.id, d.getTime());
                      }
                    }
                    setPostponeModalTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                  <Text style={{ color: colors.text }}>С напоминанием</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (postponeTask) {
                      setEditingTaskId(postponeTask.id);
                      setReminderPickerOpen(true);
                      setReminderAndroidMode('date');
                    }
                    setPostponeModalTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
                  <Text style={{ color: '#fff' }}>Изменить</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const LIGHT = {
  bg: '#ffffff',
  surface: '#f4f6f8',
  surface2: '#e9eef3',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#22c55e',
  overdue: '#ef4444',
};

const DARK = {
  bg: '#0b0f14',
  surface: '#121822',
  surface2: '#1b2635',
  text: '#e5e7eb',
  muted: '#9ca3af',
  border: '#243244',
  accent: '#4caf50',
  overdue: '#ef4444',
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 2, fontSize: 13 },
  tabs: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden' },
  tab: { paddingHorizontal: 12, paddingVertical: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progressRow: { marginTop: 10, gap: 6 },
  progressTrack: { height: 8, borderRadius: 999 },
  progressFill: { height: 8, borderRadius: 999 },
  progressText: { fontSize: 12 },
  body: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  search: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  taskRowCompact: { paddingVertical: 10 },
  taskRowExpanded: { paddingVertical: 16 },
  check: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  taskTextCol: { flex: 1, gap: 4 },
  taskText: { fontSize: 15, lineHeight: 20 },
  taskMeta: { fontSize: 12 },
  smallBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  empty: { padding: 24, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center' },
  doneWrap: { paddingTop: 10, paddingBottom: 12 },
  doneTitle: { marginLeft: 16, marginTop: 8, marginBottom: 4, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  addInput: { flex: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  addBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '88%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { marginTop: 12, marginBottom: 8, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  editInput: { minHeight: 120, borderRadius: 14, padding: 12 },
  confirmBox: { padding: 16, margin: 16, borderRadius: 16, borderWidth: 1 },
});


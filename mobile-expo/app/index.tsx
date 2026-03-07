import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { CalendarList } from 'react-native-calendars';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import type { DayStr, Settings, Task } from '../src/types';
import { DEFAULT_SETTINGS, getSettings, getSkipDeleteConfirmUntil, getTasks, saveSettings, saveTasks } from '../src/lib/storage';
import { createTask, getCurrentDayStr, getDayStats, getTodayStats, rolloverTasks, todayStr, tomorrowStr } from '../src/lib/tasks';
import { requestPermissions, syncDailyNotifications, syncOverdueReminder, syncTaskReminders } from '../src/lib/notifications';

const WEEKDAY_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

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

type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'url'; value: string }
  | { type: 'phone'; value: string }
  | { type: 'link'; label: string; url: string };

function parseLinksAndPhones(text: string): TextSegment[] {
  if (!text || !text.trim()) return [{ type: 'text', value: text }];
  const all: { index: number; end: number; seg: TextSegment }[] = [];
  let m: RegExpExecArray | null;

  // [текст](url) — как в веб-версии
  const linkRe = /\[([^\]]*)\]\(([^)]*)\)/g;
  linkRe.lastIndex = 0;
  while ((m = linkRe.exec(text)) !== null) {
    const label = m[1] || m[2];
    const url = m[2].trim();
    if (url) all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'link', label, url } });
  }

  // URL: http(s) или www. (не внутри уже найденного []())
  const urlRe = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  urlRe.lastIndex = 0;
  while ((m = urlRe.exec(text)) !== null) {
    if (!all.some((a) => a.index <= m!.index && a.end >= m!.index + m![0].length)) {
      all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'url', value: m[0] } });
    }
  }

  // Телефон: +7..., 8...
  const phoneRe = /\+?[78][\s\-\(\)]*\d[\d\s\-\(\)]{9,}/g;
  phoneRe.lastIndex = 0;
  while ((m = phoneRe.exec(text)) !== null) {
    if (!all.some((a) => a.index <= m!.index && a.end >= m!.index + m![0].length)) {
      all.push({ index: m.index, end: m.index + m[0].length, seg: { type: 'phone', value: m[0] } });
    }
  }

  all.sort((a, b) => a.index - b.index);
  const segments: TextSegment[] = [];
  let last = 0;
  for (const { index, end, seg } of all) {
    if (index > last) segments.push({ type: 'text', value: text.slice(last, index) });
    segments.push(seg);
    last = end;
  }
  if (last < text.length) segments.push({ type: 'text', value: text.slice(last) });
  return segments.length ? segments : [{ type: 'text', value: text }];
}

export default function DeloScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [dayView, setDayView] = useState<DayView>('today');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const [settingsTab, setSettingsTab] = useState<'notifications' | 'settings'>('settings');
  const [thankYouVisible, setThankYouVisible] = useState(false);

  const addInputRef = useRef<TextInput>(null);
  const editingTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    editingTaskIdRef.current = editingTaskId;
  }, [editingTaskId]);

  function formatTimeAMPM(hour: number, minute: number) {
    const h = hour % 12 || 12;
    const m = String(minute).padStart(2, '0');
    return hour < 12 ? `${h}:${m} AM` : `${h}:${m} PM`;
  }

  function formatTaskDateTime(ts: number) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} · ${h}:${m}`;
  }

  function formatReminderLabel(reminderAt: number) {
    const d = new Date(reminderAt);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const timeStr = `${h}:${m}`;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const reminderDay = new Date(d);
    reminderDay.setHours(0, 0, 0, 0);
    if (reminderDay.getTime() === today.getTime() || reminderDay.getTime() === tomorrow.getTime()) {
      return `Напоминание в ${timeStr}`;
    }
    const day = d.getDate();
    const month = d.toLocaleDateString('ru-RU', { month: 'short' });
    return `Напоминание ${day} ${month} в ${timeStr}`;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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

        const response = await Notifications.getLastNotificationResponseAsync();
        if (!cancelled && response?.notification?.request?.content?.data) {
          const data = response.notification.request.content.data as { taskId?: string };
          if (data.taskId && rolled.some((t) => t.id === data.taskId)) setEditingTaskId(data.taskId);
        }
      } catch {
        if (!cancelled) {
          setTasks([]);
          setSettingsState({ ...DEFAULT_SETTINGS });
        }
      }
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
      // Если приложение открыли тапом по уведомлению о деле — открыть карточку дела (на случай, если response listener ещё не сработал).
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          const data = response?.notification?.request?.content?.data as { taskId?: string } | undefined;
          if (data?.taskId) setEditingTaskId(data.taskId);
        })
        .catch(() => {});
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
      if (taskId) setEditingTaskId(taskId);
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
    const marks: Record<string, { marked: boolean; dots: { key: string; color: string }[] }> = {};
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const todayTime = today0.getTime();

    const daysUntil = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const t = new Date(y, m - 1, d).getTime();
      return Math.round((t - todayTime) / (24 * 60 * 60 * 1000));
    };
    const dotColor = (dateStr: string) => (daysUntil(dateStr) < 7 ? '#ef4444' : '#22c55e'); // red if < 7 days until date, green if >= 7 days

    // Dates with a reminder or a task: one dot — red if < 7 days until that date, green if >= 7 days
    for (const t of tasks) {
      if (t.reminderAt) {
        const ds = new Date(t.reminderAt).toISOString().slice(0, 10);
        marks[ds] = { marked: true, dots: [{ key: 'dot', color: dotColor(ds) }] };
      }
      if (t.forDay && !marks[t.forDay]) {
        marks[t.forDay] = { marked: true, dots: [{ key: 'dot', color: dotColor(t.forDay) }] };
      }
    }
    // Selected day — keep one dot, add selection
    const cur = marks[currentDayStr];
    marks[currentDayStr] = {
      marked: true,
      dots: cur?.dots?.length ? cur.dots : [{ key: 'dot', color: dotColor(currentDayStr) }],
      selected: true,
      selectedColor: colors.accent,
    };
    return marks;
  }, [tasks, currentDayStr, colors.accent]);

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
    const wasCompleting = tasks.find((t) => t.id === id)?.completedAt == null;
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
    if (wasCompleting) {
      setThankYouVisible(true);
      setTimeout(() => setThankYouVisible(false), 2500);
    }
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
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const nextTask: Task = { ...t, reminderAt: reminderAt || null };
        if (reminderAt) {
          const reminderDateStr = new Date(reminderAt).toISOString().slice(0, 10) as DayStr;
          if (reminderDateStr !== today && reminderDateStr !== tomorrow) {
            nextTask.forDay = reminderDateStr;
          }
        }
        return nextTask;
      });
      syncTaskReminders(next).catch(() => {});
      syncOverdueReminder(next).catch(() => {});
      return next;
    });
  };

  const reorderTasks = (params: { from: number; to: number; data?: Task[] }, forDay: DayStr) => {
    const { from: fromIndex, to: toIndex, data: reorderedData } = params;
    setTasks((prev) => {
      const forDayIncomplete = prev.filter((t) => t.forDay === forDay && !t.completedAt);
      const completedSameDay = prev.filter((t) => t.forDay === forDay && t.completedAt);
      const rest = prev.filter((t) => t.forDay !== forDay);
      const list = [...forDayIncomplete].sort((a, b) => taskSortKey(a) - taskSortKey(b));
      const reordered =
        reorderedData && reorderedData.length === list.length
          ? reorderedData.map((t, i) => ({ ...t, order: i }))
          : (() => {
              const [removed] = list.splice(fromIndex, 1);
              list.splice(toIndex, 0, removed);
              return list.map((t, i) => ({ ...t, order: i }));
            })();
      return [...reordered, ...completedSameDay, ...rest];
    });
  };

  const editingTask = tasks.find((t) => t.id === editingTaskId) || null;
  const postponeTask = tasks.find((t) => t.id === postponeModalTaskId) || null;

  useEffect(() => {
    if (editingTaskId) {
      if (!editingTask) {
        // Сбрасываем только если задачи уже загружены и такой нет (например, удалили). Пока tasks пустой — ждём загрузки, чтобы по тапу уведомления открылась карточка.
        if (tasks.length > 0) setEditingTaskId(null);
        return;
      }
      setEditDraft(editingTask.text ?? '');
      const base =
        editingTask.reminderAt && editingTask.reminderAt > Date.now()
          ? new Date(editingTask.reminderAt)
          : new Date();
      setReminderTemp(base);
    } else {
      setEditDraft('');
    }
  }, [editingTaskId, editingTask, tasks.length]);

  const closeEditModal = () => {
    if (editingTaskId && editDraft.trim() !== '') {
      updateTask(editingTaskId, editDraft);
    }
    setEditingTaskId(null);
    setReminderPickerOpen(false);
  };

  if (!settings) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.center, { backgroundColor: colors.bg }]}>
          <Text style={{ color: colors.text }}>Загрузка…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right', 'bottom']}>
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
                  style={[styles.tab, dayView === 'today' && { backgroundColor: colors.tabActive }]}>
                  <Text style={{ color: colors.text, fontWeight: dayView === 'today' ? '700' : '400' }}>
                    {settings.headerTabsStyle === 'short'
                      ? WEEKDAY_SHORT[new Date().getDay()]
                      : 'Сегодня'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDayView('tomorrow')}
                  style={[styles.tab, dayView === 'tomorrow' && { backgroundColor: colors.tabActive }]}>
                  <Text style={{ color: colors.text, fontWeight: dayView === 'tomorrow' ? '700' : '400' }}>
                    {settings.headerTabsStyle === 'short'
                      ? WEEKDAY_SHORT[(new Date().getDay() + 1) % 7]
                      : 'Завтра'}
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setCalendarOpen(true)} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="calendar-outline" size={22} color={colors.text} />
              </Pressable>
              <Pressable onPress={() => setSettingsOpen(true)} style={[styles.iconBtn, { backgroundColor: colors.surface }]}>
                <Ionicons name="settings-outline" size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressTrack, { backgroundColor: colors.overdue }]}>
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
              placeholder="Поиск по делам..."
              placeholderTextColor={colors.muted}
              style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]}
            />
          </View>

          <DraggableFlatList
            data={incomplete}
            keyExtractor={(item) => item.id}
            onDragEnd={(p) => reorderTasks(p, currentDayStr)}
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
                <View style={styles.taskArrows}>
                  <Text style={{ color: colors.accent, fontSize: 12 }}>▲</Text>
                  <Text style={{ color: colors.overdue, fontSize: 12 }}>▼</Text>
                </View>
                <Pressable onPress={() => toggleTask(item.id)} style={[styles.check, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text }}>{item.completedAt ? '✓' : ''}</Text>
                </Pressable>
                <View style={styles.taskTextCol}>
                  <Text style={[styles.taskText, { color: colors.text }]} numberOfLines={3}>
                    {parseLinksAndPhones(item.text).map((seg, i) =>
                      seg.type === 'text' ? (
                        <Text key={i} style={{ color: colors.text }}>{seg.value}</Text>
                      ) : seg.type === 'link' ? (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => {
                            const url = seg.url.startsWith('http') ? seg.url : `https://${seg.url}`;
                            Linking.openURL(url).catch(() => {});
                          }}>
                          {seg.label}
                        </Text>
                      ) : seg.type === 'url' ? (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => {
                            const url = seg.value.startsWith('http') ? seg.value : `https://${seg.value}`;
                            Linking.openURL(url).catch(() => {});
                          }}>
                          {seg.value}
                        </Text>
                      ) : (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => Linking.openURL(`tel:${seg.value.replace(/\D/g, '')}`).catch(() => {})}>
                          {seg.value}
                        </Text>
                      )
                    )}
                  </Text>
                  <Text style={[styles.taskMeta, { color: (item.reminderAt && item.reminderAt > Date.now()) ? colors.accent : colors.muted }]}>
                    {(item.reminderAt && item.reminderAt > Date.now())
                      ? formatReminderLabel(item.reminderAt)
                      : formatTaskDateTime(item.createdAt)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      setEditingTaskId(item.id);
                    }}
                    style={styles.smallBtn}
                    hitSlop={8}>
                    <Text style={{ color: item.reminderAt && item.reminderAt > Date.now() ? colors.accent : colors.muted, fontSize: 14 }}>🕐</Text>
                  </Pressable>
                  {dayView === 'today' && currentDayStr === todayStr() && (
                    <Pressable
                      onPress={() => handlePostponePress(item)}
                      style={[styles.smallBtn, { backgroundColor: colors.surface2 }]}>
                      <Text style={{ color: colors.text, fontSize: 12 }}>Завтра</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => deleteTask(item.id)} style={styles.smallBtn}>
                    <Text style={{ color: colors.muted }}>🗑️</Text>
                  </Pressable>
                </View>
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
                    {parseLinksAndPhones(t.text).map((seg, i) =>
                      seg.type === 'text' ? (
                        <Text key={i} style={{ color: colors.text, textDecorationLine: 'line-through' }}>{seg.value}</Text>
                      ) : seg.type === 'link' ? (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => {
                            const url = seg.url.startsWith('http') ? seg.url : `https://${seg.url}`;
                            Linking.openURL(url).catch(() => {});
                          }}>
                          {seg.label}
                        </Text>
                      ) : seg.type === 'url' ? (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => {
                            const url = seg.value.startsWith('http') ? seg.value : `https://${seg.value}`;
                            Linking.openURL(url).catch(() => {});
                          }}>
                          {seg.value}
                        </Text>
                      ) : (
                        <Text
                          key={i}
                          style={{ color: colors.link, textDecorationLine: 'underline' }}
                          onPress={() => Linking.openURL(`tel:${seg.value.replace(/\D/g, '')}`).catch(() => {})}>
                          {seg.value}
                        </Text>
                      )
                    )}
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

        {/* Calendar modal — одинаковые отступы от краёв окна */}
        <Modal visible={calendarOpen} animationType="slide" transparent onRequestClose={() => setCalendarOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, styles.calendarSheet, { backgroundColor: colors.bg, height: '85%', overflow: 'hidden' }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Планы на день</Text>
                <Pressable onPress={() => setCalendarOpen(false)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <View style={[styles.calendarListWrap, { overflow: 'hidden' }]}>
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
                  style={styles.calendarListOuter}
                  calendarStyle={styles.calendarListInner}
                  theme={{
                  calendarBackground: 'transparent',
                  dayTextColor: colors.text,
                  monthTextColor: colors.text,
                  textDisabledColor: colors.muted,
                  selectedDayBackgroundColor: colors.accent,
                  selectedDayTextColor: '#fff',
                  todayTextColor: colors.accent,
                  arrowColor: colors.text,
                  weekVerticalMargin: 4,
                }}
                />
              </View>
              <View style={styles.calendarLegend}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Красная точка — до даты остаётся меньше 7 дней.
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Зелёная — до даты остаётся 7 дней и больше.
                </Text>
              </View>
            </View>
          </View>
        </Modal>

        {/* Settings modal — вкладки Уведомления / Настройки, как на референсе */}
        <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={[styles.modalHeader, { borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 }]}>
                <View style={{ flexDirection: 'row', gap: 20 }}>
                  <Pressable onPress={() => setSettingsTab('notifications')}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: settingsTab === 'notifications' ? '700' : '400',
                        color: settingsTab === 'notifications' ? colors.text : colors.muted,
                        borderBottomWidth: settingsTab === 'notifications' ? 2 : 0,
                        borderBottomColor: colors.accent,
                        paddingBottom: 4,
                      }}>
                      Уведомления
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setSettingsTab('settings')}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: settingsTab === 'settings' ? '700' : '400',
                        color: settingsTab === 'settings' ? colors.text : colors.muted,
                        borderBottomWidth: settingsTab === 'settings' ? 2 : 0,
                        borderBottomColor: colors.accent,
                        paddingBottom: 4,
                      }}>
                      Настройки
                    </Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setSettingsOpen(false)}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                {settingsTab === 'notifications' ? (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 0 }]}>УВЕДОМЛЕНИЯ</Text>
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
                          <Text style={{ color: colors.text }}>Очистить все</Text>
                        </Pressable>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 0 }]}>ТЕМА</Text>
                    <View style={styles.row}>
                      {(['light', 'dark', 'system'] as const).map((t) => (
                        <Pressable
                          key={t}
                          onPress={() => {
                            setSettingsState((s) => (s ? { ...s, theme: t } : s));
                          }}
                          style={[styles.chip, { backgroundColor: settings.theme === t ? colors.accent : colors.surface }]}>
                          <Text style={{ color: settings.theme === t ? '#fff' : colors.text }}>
                            {t === 'light' ? 'Светлая' : t === 'dark' ? 'Тёмная' : 'Моя'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.muted }]}>КНОПКИ СЕГОДНЯ / ЗАВТРА</Text>
                    <View style={styles.row}>
                      {(['full', 'short'] as const).map((tabsStyle) => (
                        <Pressable
                          key={tabsStyle}
                          onPress={() => setSettingsState((s) => (s ? { ...s, headerTabsStyle: tabsStyle } : s))}
                          style={[styles.chip, { backgroundColor: (settings.headerTabsStyle ?? 'full') === tabsStyle ? colors.accent : colors.surface }]}>
                          <Text style={{ color: (settings.headerTabsStyle ?? 'full') === tabsStyle ? '#fff' : colors.text }}>
                            {tabsStyle === 'full' ? 'Сегодня / Завтра' : 'ПН / ВТ'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.muted }]}>РЕЖИМ СПИСКА</Text>
                    <View style={styles.row}>
                      {(['compact', 'expanded'] as const).map((m) => (
                        <Pressable
                          key={m}
                          onPress={() => setSettingsState((s) => (s ? { ...s, listMode: m } : s))}
                          style={[styles.chip, { backgroundColor: settings.listMode === m ? colors.accent : colors.surface }]}>
                          <Text style={{ color: settings.listMode === m ? '#fff' : colors.text }}>
                            {m === 'compact' ? 'Компактный' : 'Развёрнутый'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={[styles.sectionTitle, { color: colors.muted }]}>ЕЖЕДНЕВНЫЕ УВЕДОМЛЕНИЯ (РАЗ В ДЕНЬ)</Text>
                    {(settings.dailyNotifications || []).slice(0, 2).map((slot, idx) => (
                      <View key={idx} style={[styles.slotRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <Pressable
                            onPress={() =>
                              setSettingsState((s) => {
                                if (!s) return s;
                                const next = [...s.dailyNotifications];
                                next[idx] = { ...next[idx], enabled: !(slot.enabled !== false) };
                                return { ...s, dailyNotifications: next };
                              })
                            }>
                            <Text style={{ color: colors.text, fontSize: 16 }}>
                              {slot.enabled !== false ? '☑' : '☐'} {idx === 0 ? 'Утро' : 'Вечер'}
                            </Text>
                          </Pressable>
                        </View>
                        <Pressable
                          onPress={() => {
                            const d = new Date();
                            d.setHours(slot.hour ?? 9, slot.minute ?? 0, 0, 0);
                            setDailyTimeTemp(d);
                            setDailyTimePickerIdx(idx);
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={{ color: colors.text }}>
                            {formatTimeAMPM(slot.hour ?? 9, slot.minute ?? 0)}
                          </Text>
                          <Text style={{ color: colors.muted }}>▼</Text>
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

                    <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <View>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Разработано 379team</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Версия 1.0.0</Text>
                      </View>
                      <Pressable
                        onPress={() => Linking.openURL('https://delodelai.ru').catch(() => {})}
                        style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                        <Text style={{ color: colors.text }}>Поддержка</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Edit task modal — текст сохраняется при закрытии (крестик/назад); в блоке напоминания только Напомнить/Убрать */}
        <Modal visible={!!editingTaskId && !!editingTask} animationType="slide" transparent onRequestClose={closeEditModal}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.bg }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Редактировать</Text>
                <Pressable onPress={closeEditModal}>
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                style={[styles.editInput, { backgroundColor: colors.surface, color: colors.text }]}
              />
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                Выберите день и время ниже, затем нажмите «Напомнить».
              </Text>
              {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const rtDay = new Date(reminderTemp);
                rtDay.setHours(0, 0, 0, 0);
                const dayMode: 'Сегодня' | 'Завтра' | 'Дата' =
                  rtDay.getTime() === today.getTime() ? 'Сегодня' : rtDay.getTime() === tomorrow.getTime() ? 'Завтра' : 'Дата';
                const h = reminderTemp.getHours();
                const m = reminderTemp.getMinutes();
                const timePreset =
                  h === 9 && m === 0 ? '09:00' : h === 13 && m === 0 ? '13:00' : h === 15 && m === 0 ? '15:00' : 'Другое';
                return (
                  <View style={{ marginTop: 12, gap: 12 }}>
                    <Text style={[styles.sectionTitle, { color: colors.muted, marginTop: 0 }]}>День</Text>
                    <View style={styles.row}>
                      {(['Сегодня', 'Завтра', 'Дата'] as const).map((label) => (
                        <Pressable
                          key={label}
                          onPress={() => {
                            const d = new Date(reminderTemp);
                            if (label === 'Сегодня') {
                              const t = new Date();
                              d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate());
                            } else if (label === 'Завтра') {
                              const t = new Date();
                              t.setDate(t.getDate() + 1);
                              d.setFullYear(t.getFullYear(), t.getMonth(), t.getDate());
                            } else {
                              setReminderPickerOpen(true);
                              setReminderAndroidMode('date');
                              return;
                            }
                            setReminderTemp(d);
                          }}
                          style={[styles.chip, { backgroundColor: dayMode === label ? colors.accent : colors.surface }]}>
                          <Text style={{ color: dayMode === label ? '#fff' : colors.text }}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[styles.sectionTitle, { color: colors.muted }]}>Время</Text>
                    <View style={styles.row}>
                      {[
                        { label: '09:00', h: 9, m: 0 },
                        { label: '13:00', h: 13, m: 0 },
                        { label: '15:00', h: 15, m: 0 },
                        { label: 'Другое', h: null, m: null },
                      ].map((p) => (
                        <Pressable
                          key={p.label}
                          onPress={() => {
                            if (p.h === null) {
                              setReminderPickerOpen(true);
                              setReminderAndroidMode('time');
                              return;
                            }
                            const d = new Date(reminderTemp);
                            d.setHours(p.h!, p.m!, 0, 0);
                            setReminderTemp(d);
                          }}
                          style={[styles.chip, { backgroundColor: timePreset === p.label ? colors.accent : colors.surface }]}>
                          <Text style={{ color: timePreset === p.label ? '#fff' : colors.text }}>{p.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })()}
              {reminderTemp.getTime() <= Date.now() && (
                <View style={{ backgroundColor: colors.overdue, padding: 10, borderRadius: 10, marginTop: 12 }}>
                  <Text style={{ color: '#fff', fontSize: 13 }}>Прошедшую дату установить нельзя</Text>
                </View>
              )}
              <View style={[styles.row, { marginTop: 12 }]}>
                <Pressable
                  onPress={() => {
                    const id = editingTaskIdRef.current ?? editingTaskId;
                    if (!id) return;
                    const ts = reminderTemp.getTime();
                    setReminderPickerOpen(false);
                    const now = Date.now();
                    if (ts > now) {
                      setTaskReminder(id, ts);
                    } else {
                      setTaskReminder(id, now + 60000);
                    }
                    setEditingTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
                  android_ripple={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Text style={{ color: '#fff' }}>Напомнить</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const id = editingTaskIdRef.current ?? editingTaskId;
                    if (!id) return;
                    setTaskReminder(id, null);
                    setReminderPickerOpen(false);
                    setEditingTaskId(null);
                  }}
                  style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}
                  android_ripple={{ color: 'rgba(0,0,0,0.1)' }}>
                  <Text style={{ color: colors.text }}>Убрать</Text>
                </Pressable>
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
                      <Text style={{ color: '#fff' }}>Напомнить</Text>
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

              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Delete confirm — по центру экрана */}
        <Modal visible={!!confirmDeleteTaskId} animationType="fade" transparent onRequestClose={() => setConfirmDeleteTaskId(null)}>
          <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
            <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Задачу нельзя будет восстановить.</Text>
              <Text style={{ color: colors.text, fontSize: 16, marginTop: 8 }}>Удалить?</Text>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Pressable onPress={confirmDelete} style={[styles.primaryBtn, { backgroundColor: colors.overdue, flex: 1 }]}>
                  <Text style={{ color: '#fff' }}>Удалить</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmDeleteTaskId(null)} style={[styles.primaryBtn, { backgroundColor: colors.surface2, flex: 1 }]}>
                  <Text style={{ color: colors.text }}>Отмена</Text>
                </Pressable>
              </View>
              <Pressable onPress={() => setDontAskDeleteAgain((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
                <Text style={{ color: colors.text }}>{dontAskDeleteAgain ? '☑' : '☐'}</Text>
                <Text style={{ color: colors.text }}>Больше не спрашивать (3 дня)</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        {/* Перенос на завтра: кнопка «Завтра» + варианты с напоминанием */}
        <Modal visible={!!postponeModalTaskId} animationType="fade" transparent onRequestClose={() => setPostponeModalTaskId(null)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
                {postponeTask?.reminderAt ? 'У дела есть напоминание сегодня' : 'Перенести на завтра?'}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 8 }}>
                {postponeTask?.reminderAt
                  ? 'Если перенести дело на завтра, что сделать с напоминанием?'
                  : 'Дело будет перенесено на завтра.'}
              </Text>
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
                style={[styles.primaryBtn, { backgroundColor: colors.accent, marginTop: 14 }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Завтра</Text>
              </Pressable>
              {postponeTask?.reminderAt ? (
                <View style={[styles.row, { marginTop: 10 }]}>
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
                        setEditingTaskId(postponeTask.id);
                        setReminderPickerOpen(true);
                        setReminderAndroidMode('date');
                      }
                      setPostponeModalTaskId(null);
                    }}
                    style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                    <Text style={{ color: colors.text }}>Изменить</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        {thankYouVisible && (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]} pointerEvents="none">
            <View style={{ backgroundColor: colors.accent, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Отлично!</Text>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const LIGHT = {
  bg: '#ffffff',
  surface: '#e8ecf1',
  surface2: '#d8dfe8',
  tabActive: '#dcfce7',
  text: '#111827',
  muted: '#6b7280',
  border: '#d1d9e2',
  accent: '#22c55e',
  link: '#2563eb',
  overdue: '#ef4444',
};

const DARK = {
  bg: '#0b0f14',
  surface: '#1c2733',
  surface2: '#283548',
  tabActive: '#1e3a2f',
  text: '#e5e7eb',
  muted: '#9ca3af',
  border: '#334155',
  accent: '#4caf50',
  link: '#60a5fa',
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
  tabs: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' },
  tab: { minWidth: 68, paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
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
  taskArrows: { alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 2 },
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
  calendarSheet: { paddingHorizontal: 20, paddingVertical: 16 },
  calendarListWrap: { flex: 1, alignItems: 'center', width: '100%', minHeight: 320 },
  calendarListOuter: {
    width: Math.floor(Dimensions.get('window').width) - 48,
    maxWidth: '100%',
    height: Math.max(320, Dimensions.get('window').height * 0.45),
  },
  calendarListInner: { marginHorizontal: 0, maxWidth: '100%' },
  calendarLegend: { paddingTop: 8, paddingBottom: 8, gap: 6 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { marginTop: 12, marginBottom: 8, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
  slotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  editInput: { minHeight: 120, borderRadius: 14, padding: 12 },
  confirmBox: { padding: 16, margin: 16, borderRadius: 16, borderWidth: 1 },
});


import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef, useState } from 'react';
import Constants from 'expo-constants';
import {
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, {
  NestableDraggableFlatList,
  NestableScrollContainer,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';

import type { DayStr, RepeatRule, Settings, Subtask, Task } from '../src/types';
import { CalendarModal } from '../src/components/CalendarModal';
import { ConfirmDeleteModal } from '../src/components/ConfirmDeleteModal';
import { PostponeTaskModal } from '../src/components/PostponeTaskModal';
import { ThankYouToast } from '../src/components/ThankYouToast';
import { type DayView, formatHeaderDate, isDayStr, isPastDayStr, taskSortKey } from '../src/lib/dayView';
import { DEFAULT_SETTINGS, getSettings, getSkipDeleteConfirmUntil, getTasks, saveSettings, saveTasks } from '../src/lib/storage';
import { parseLinksAndPhones } from '../src/lib/textSegments';
import { useResolvedTheme } from '../hooks/use-resolved-theme';
import {
  addSubtaskToTask,
  createNextRepeatedTask,
  createTask,
  dayStrFromDateLocal,
  deleteSubtaskFromTask,
  getCurrentDayStr,
  getDayStats,
  getRepeatLabel,
  getTodayStats,
  rolloverTasks,
  todayStr,
  toggleSubtaskInTask,
  tomorrowStr,
  updateSubtaskInTask,
} from '../src/lib/tasks';
import { disableOverdueReminders, requestPermissions, syncDailyNotifications, syncTaskReminders } from '../src/lib/notifications';

const WEEKDAY_SHORT = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const IS_NATIVE_NOTIFICATIONS = Platform.OS === 'ios' || Platform.OS === 'android';

export default function DeloScreen() {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [dayView, setDayView] = useState<DayView>('today');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const newTaskTextRef = useRef('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskEditDraft, setSubtaskEditDraft] = useState('');
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [reminderTemp, setReminderTemp] = useState<Date>(new Date());
  const [showPastReminderWarning, setShowPastReminderWarning] = useState(false);
  const [reminderAndroidMode, setReminderAndroidMode] = useState<'date' | 'time'>('date');
  const [dailyTimePickerIdx, setDailyTimePickerIdx] = useState<number | null>(null);
  const [dailyTimeTemp, setDailyTimeTemp] = useState<Date>(new Date());
  const [postponeModalTaskId, setPostponeModalTaskId] = useState<string | null>(null);
  const [reminderNotifications, setReminderNotifications] = useState<
    { id: string; requestId: string; taskId: string | null; text: string; firedAt: number }[]
  >([]);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [dontAskDeleteAgain, setDontAskDeleteAgain] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'notifications' | 'settings'>('settings');
  const [thankYouVisible, setThankYouVisible] = useState(false);

  const addInputRef = useRef<TextInput>(null);
  const editingTaskIdRef = useRef<string | null>(null);
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const changeFrameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidChangeFrame';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates?.height ?? 0);
    });
    const changeSub = Keyboard.addListener(changeFrameEvent as any, (e: any) => {
      setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      changeSub.remove();
      hideSub.remove();
    };
  }, []);

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

  const handleNotificationOpen = (response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return;
    const requestId = response.notification.request.identifier;
    const data = response.notification.request.content.data as { taskId?: unknown } | undefined;
    const taskId = typeof data?.taskId === 'string' ? data.taskId : undefined;

    if (requestId) {
      setReminderNotifications((prev) => prev.filter((n) => n.requestId !== requestId));
      if (IS_NATIVE_NOTIFICATIONS) Notifications.dismissNotificationAsync(requestId).catch(() => {});
    }
    if (IS_NATIVE_NOTIFICATIONS) (Notifications as any).clearLastNotificationResponseAsync?.().catch(() => {});

    setSettingsOpen(false);
    setCalendarOpen(false);
    setSearchQuery('');
    setReminderPickerOpen(false);
    setPostponeModalTaskId(null);

    if (taskId) {
      // Если задача уже есть в стейте — переключим вкладку на её день,
      // чтобы пользователь видел задачу в правильном контексте.
      const t = tasksRef.current.find((x) => x.id === taskId);
      if (t?.forDay) setDayView(t.forDay);
      setEditingTaskId(taskId);
    } else {
      // For non-task notifications: open main tasks view.
      setEditingTaskId(null);
      setDayView('today');
    }
  };

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

        if (IS_NATIVE_NOTIFICATIONS) {
          // Только запрашиваем разрешения при первом запуске. Синхронизацию напоминаний делает эффект ниже.
          // Также отключаем устаревшие "просроченные" уведомления (если были запланированы в прошлых версиях).
          requestPermissions()
            .then(() => disableOverdueReminders())
            .catch((e) => console.warn('[notifications] init failed', e));

          const response = await Notifications.getLastNotificationResponseAsync();
          if (!cancelled) handleNotificationOpen(response);
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
  const appVersion = Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? '—';
  const buildLabel =
    Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.buildNumber
      : Platform.OS === 'android'
        ? Constants.expoConfig?.android?.versionCode
        : undefined;
  const versionLabel = buildLabel != null ? `${appVersion} (${buildLabel})` : String(appVersion);
  const checkBorderColor = resolvedTheme === 'light' ? '#8fa0b5' : '#6b7f99';
  const checkBgColor = resolvedTheme === 'light' ? '#eef2f7' : '#142133';
  const pickerLabelColor = resolvedTheme === 'dark' ? '#cbd5e1' : colors.muted;
  const dateTimePickerTextColor = resolvedTheme === 'dark' ? '#e5e7eb' : '#111827';
  const EditScrollContainer = Platform.OS === 'web' ? ScrollView : NestableScrollContainer;

  function renderTaskDatesMeta(item: Task) {
    const reminderLineColor =
      item.reminderAt == null
        ? colors.muted
        : item.completedAt
          ? colors.muted
          : item.reminderAt <= Date.now()
            ? colors.overdue
            : colors.accent;

    return (
      <View style={{ alignSelf: 'stretch', gap: 2 }}>
        <Text style={[styles.taskMeta, { color: colors.muted }]}>Создано: {formatTaskDateTime(item.createdAt)}</Text>
        {item.focusRank ? (
          <Text style={[styles.taskMeta, { color: colors.accent }]}>Фокус дня #{item.focusRank}</Text>
        ) : null}
        {item.repeatRule && item.repeatRule !== 'none' ? (
          <Text style={[styles.taskMeta, { color: colors.muted }]}>Повтор: {getRepeatLabel(item.repeatRule)}</Text>
        ) : null}
        {item.reminderAt != null ? (
          <Text style={[styles.taskMeta, { color: reminderLineColor }]}>Напоминание: {formatTaskDateTime(item.reminderAt)}</Text>
        ) : null}
      </View>
    );
  }

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
      if (IS_NATIVE_NOTIFICATIONS) Notifications.setBadgeCountAsync(0).catch(() => {});
      setTasks((prev) => {
        const rolled = rolloverTasks(prev);
        if (rolled !== prev) {
          saveTasks(rolled).catch(() => {});
          return rolled;
        }
        return prev;
      });
      // If app became active after tapping a notification, open task/main view accordingly.
      if (IS_NATIVE_NOTIFICATIONS) {
        Notifications.getLastNotificationResponseAsync()
          .then((response) => handleNotificationOpen(response))
          .catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Лисенеры уведомлений: пополняем список "Уведомления" внутри приложения.
  useEffect(() => {
    if (!IS_NATIVE_NOTIFICATIONS) return;
    const sub1 = Notifications.addNotificationReceivedListener((n) => {
      const now = Date.now();
      const text = n.request.content.body || 'Напоминание';
      const requestId = n.request.identifier;
      const taskId = (n.request.content.data as any)?.taskId ?? null;
      setReminderNotifications((prev) =>
        prev.some((x) => x.requestId === requestId)
          ? prev
          : [...prev, { id: `rem_${requestId}_${now}`, requestId, taskId, text, firedAt: now }]
      );
      Notifications.getBadgeCountAsync()
        .then((c) => Notifications.setBadgeCountAsync((c ?? 0) + 1))
        .catch(() => {});
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((r) => {
      handleNotificationOpen(r);
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // Синхронизацию уведомлений делаем только когда реально меняются напоминания/задачи,
  // а не при любом изменении настроек (например, переключение темы/вида списка).
  const tasksSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dailySyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const taskRemindersKey = useMemo(() => {
    // Достаточно id/reminderAt — тема/вид списка сюда не входят.
    return (tasks || []).map((t) => `${t.id}:${t.reminderAt ?? 0}`).join('|');
  }, [tasks]);

  const dailyNotificationsKey = useMemo(() => {
    const list = settings?.dailyNotifications ?? [];
    return list.map((s) => `${s.enabled ? 1 : 0}:${s.hour ?? 0}:${s.minute ?? 0}:${s.text ?? ''}`).join('|');
  }, [settings?.dailyNotifications]);

  const settingsReady = !!settings;

  const dailySlotsRef = useRef<Settings['dailyNotifications']>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    dailySlotsRef.current = settings?.dailyNotifications ?? [];
  }, [settings?.dailyNotifications]);

  const openFromInAppNotification = (n: {
    requestId: string;
    taskId: string | null;
  }) => {
    // Убираем запись из "Уведомлений" внутри приложения
    setReminderNotifications((prev) => prev.filter((x) => x.requestId !== n.requestId));

    // Убираем и из системной шторки (если устройство/платформа поддерживает)
    if (IS_NATIVE_NOTIFICATIONS) Notifications.dismissNotificationAsync(n.requestId).catch(() => {});

    // Сбрасываем открытые модалки, чтобы редактор точно отобразился
    setSettingsOpen(false);
    setCalendarOpen(false);
    setReminderPickerOpen(false);
    setPostponeModalTaskId(null);

    if (n.taskId) {
      const t = tasksRef.current.find((x) => x.id === n.taskId);
      if (t?.forDay) setDayView(t.forDay);
      setEditingTaskId(n.taskId);
    } else {
      setEditingTaskId(null);
      setDayView('today');
    }
  };

  useEffect(() => {
    if (!settingsReady) return;
    if (tasksSyncRef.current) clearTimeout(tasksSyncRef.current);
    tasksSyncRef.current = setTimeout(() => {
      // Only task reminders + ensure overdue reminders are disabled.
      Promise.all([syncTaskReminders(tasksRef.current), disableOverdueReminders()]).catch((e) =>
        console.warn('[notifications] sync tasks failed', e)
      );
    }, 800);
    return () => {
      if (tasksSyncRef.current) clearTimeout(tasksSyncRef.current);
    };
  }, [taskRemindersKey, settingsReady]);

  useEffect(() => {
    if (!settingsReady) return;
    if (dailySyncRef.current) clearTimeout(dailySyncRef.current);
    dailySyncRef.current = setTimeout(() => {
      // Daily notifications are fixed to 09:00 and 21:00 inside syncDailyNotifications.
      syncDailyNotifications(dailySlotsRef.current).catch((e) => console.warn('[notifications] sync daily failed', e));
    }, 800);
    return () => {
      if (dailySyncRef.current) clearTimeout(dailySyncRef.current);
    };
  }, [dailyNotificationsKey, settingsReady]);

  const currentDayStr = getCurrentDayStr(dayView);
  const canCreateTasksForSelectedDay = !isPastDayStr(currentDayStr);
  const stats = dayView === 'today' ? getTodayStats(tasks) : getDayStats(tasks, currentDayStr);
  const headerDateLabel = formatHeaderDate(dayView);

  // Footer is fixed to bottom; keep enough space so the last task is fully visible.
  const footerPad = 96 + insets.bottom;
  const footerBottom = keyboardHeight;
  const footerPaddingBottom = 10 + (keyboardHeight > 0 ? 0 : insets.bottom);
  const listMode = settings?.listMode ?? 'compact';

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { marked: boolean; dots: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }
    > = {};
    const today0 = new Date();
    today0.setHours(0, 0, 0, 0);
    const todayTime = today0.getTime();

    const daysUntil = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const t = new Date(y, m - 1, d).getTime();
      return Math.round((t - todayTime) / (24 * 60 * 60 * 1000));
    };
    const isTodayOrFuture = (dateStr: string) => daysUntil(dateStr) >= 0;
    const dotColor = (dateStr: string) => (daysUntil(dateStr) < 7 ? '#ef4444' : '#22c55e'); // red if < 7 days until date, green if >= 7 days

    // Dates with a reminder or a task: one dot — red if < 7 days until that date, green if >= 7 days
    for (const t of tasks) {
      if (t.reminderAt) {
        const ds = dayStrFromDateLocal(new Date(t.reminderAt));
        if (isTodayOrFuture(ds)) {
          marks[ds] = { marked: true, dots: [{ key: 'dot', color: dotColor(ds) }] };
        }
      }
      if (t.forDay && isTodayOrFuture(t.forDay) && !marks[t.forDay]) {
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
    const allInc = forDay.filter((t) => !t.completedAt).sort((a, b) => {
      const af = a.focusRank ?? 99;
      const bf = b.focusRank ?? 99;
      if (af !== bf) return af - bf;
      return taskSortKey(a) - taskSortKey(b);
    });
    const done = forDay.filter((t) => t.completedAt).sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));
    const focused = allInc.filter((t) => !!t.focusRank);
    return { incomplete: filter(focusMode ? focused : allInc), completed: focusMode ? [] : filter(done) };
  }, [tasks, currentDayStr, searchQuery, focusMode]);

  const addTask = (text: string, forDay?: DayStr) => {
    const day = forDay ?? currentDayStr;
    if (isPastDayStr(day)) return;
    setTasks((prev) => {
      // Новая задача должна появляться ВВЕРХ списка.
      // Для невыполненных задач используем `order` как индекс сверху вниз:
      // 1) новой задачe ставим order=0
      // 2) остальным невыполненным на этом дне увеличиваем order на 1
      const shifted = prev.map((t) => {
        if (t.forDay !== day) return t;
        if (t.completedAt) return t;
        return { ...t, order: (t.order ?? 0) + 1 };
      });
      return [...shifted, createTask(text, 0, day)];
    });
  };

  const toggleTask = (id: string) => {
    const wasCompleting = tasks.find((t) => t.id === id)?.completedAt == null;
    setTasks((prev) => {
      const now = Date.now();
      let repeatedTask: Task | null = null;
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const completing = t.completedAt == null;
        if (completing) repeatedTask = createNextRepeatedTask(t, now);
        return {
          ...t,
          completedAt: t.completedAt ? null : now,
          isOverdue: false,
          forDay: completing ? todayStr() : t.forDay,
          focusRank: completing ? null : t.focusRank ?? null,
        };
      });
      if (!repeatedTask) return next;
      const exists = next.some(
        (t) =>
          !t.completedAt &&
          (t.repeatSourceId || t.id) === repeatedTask!.repeatSourceId &&
          t.forDay === repeatedTask!.forDay
      );
      if (exists) return next;
      const shifted = next.map((t) => {
        if (t.forDay !== repeatedTask!.forDay || t.completedAt) return t;
        return { ...t, order: (t.order ?? 0) + 1 };
      });
      return [...shifted, repeatedTask];
    });
    if (wasCompleting) {
      setThankYouVisible(true);
      setTimeout(() => setThankYouVisible(false), 2500);
    }
  };

  const toggleFocusTask = (id: string) => {
    setTasks((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target || target.completedAt || target.forDay !== currentDayStr) return prev;
      const focused = prev
        .filter((t) => t.forDay === currentDayStr && !t.completedAt && t.focusRank && t.id !== id)
        .sort((a, b) => (a.focusRank ?? 99) - (b.focusRank ?? 99));

      if (target.focusRank) {
        return prev.map((t) => {
          if (t.id === id) return { ...t, focusRank: null, updatedAt: Date.now() };
          const nextRankIndex = focused.findIndex((x) => x.id === t.id);
          return nextRankIndex >= 0 ? { ...t, focusRank: nextRankIndex + 1 } : t;
        });
      }

      if (focused.length >= 3) return prev;
      return prev.map((t) => (t.id === id ? { ...t, focusRank: focused.length + 1, updatedAt: Date.now() } : t));
    });
  };

  const setTaskRepeatRule = (id: string, repeatRule: RepeatRule) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              repeatRule,
              repeatSourceId: repeatRule === 'none' ? null : t.repeatSourceId || t.id,
              updatedAt: Date.now(),
            }
          : t
      )
    );
  };

  const TaskRow = ({ item, drag, isActive = false }: { item: Task; drag?: () => void; isActive?: boolean }) => {
    return (
      <Swipeable
        overshootLeft={false}
        overshootRight={false}
        leftThreshold={56}
        rightThreshold={48}
        renderLeftActions={() => (
          <View style={styles.hiddenSwipeAction} />
        )}
        renderRightActions={() => (
          <View style={styles.hiddenSwipeAction} />
        )}
        onSwipeableOpen={(direction, swipeable) => {
          swipeable.close();
          if (direction === 'right') {
            toggleTask(item.id);
          } else if (direction === 'left') {
            deleteTask(item.id);
          }
        }}>
        <Pressable
          onLongPress={Platform.OS === 'web' ? undefined : drag}
          onPress={() => setEditingTaskId(item.id)}
          style={[
            styles.taskRow,
            listMode === 'compact' ? styles.taskRowCompact : styles.taskRowExpanded,
            {
              backgroundColor: colors.surface,
              borderColor: item.focusRank ? colors.accent : item.isOverdue && !item.completedAt ? colors.overdue : colors.border,
              opacity: isActive ? 0.7 : 1,
            },
          ]}>
          <Pressable
            onPress={() => toggleTask(item.id)}
            style={[
              styles.check,
              listMode === 'compact' ? styles.checkCompact : styles.checkExpanded,
              { borderColor: checkBorderColor, backgroundColor: checkBgColor },
            ]}>
            <Text style={{ color: colors.text }}>{item.completedAt ? '✓' : ''}</Text>
          </Pressable>
          <View style={styles.taskTextCol}>
            <Text
              style={[
                styles.taskText,
                { color: colors.text, textDecorationLine: item.completedAt ? 'line-through' : 'none' },
              ]}
              numberOfLines={listMode === 'compact' ? 5 : 8}>
              {parseLinksAndPhones(item.text).map((seg, i) =>
                seg.type === 'text' ? (
                  <Text key={i} style={{ color: colors.text, textDecorationLine: item.completedAt ? 'line-through' : 'none' }}>
                    {seg.value}
                  </Text>
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
            {renderTaskDatesMeta(item)}
          </View>
          <View style={styles.taskRowActions}>
            {!item.completedAt && currentDayStr === item.forDay && (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  toggleFocusTask(item.id);
                }}
                style={[
                  styles.focusChip,
                  { backgroundColor: item.focusRank ? colors.accent : colors.surface2 },
                ]}>
                <Ionicons name={item.focusRank ? 'radio-button-on' : 'radio-button-off'} size={16} color={item.focusRank ? '#fff' : colors.text} />
                {item.focusRank ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{item.focusRank}</Text> : null}
              </Pressable>
            )}
            {dayView === 'today' && currentDayStr === todayStr() && (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  handlePostponePress(item);
                }}
                style={[styles.tomorrowChip, { backgroundColor: colors.surface2 }]}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Завтра</Text>
              </Pressable>
            )}
            {(dayView === 'tomorrow' || currentDayStr === tomorrowStr()) && isTodayStillGoing && (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  moveToToday(item.id);
                }}
                style={[styles.tomorrowChip, { backgroundColor: colors.surface2 }]}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Сегодня</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Swipeable>
    );
  };

  const updateTask = (id: string, text: string) => {
    const nextText = text.trim();
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        if ((t.text || '').trim() === nextText) return t;
        return { ...t, text: nextText, isOverdue: false, updatedAt: Date.now() };
      })
    );
  };

  const addSubtask = (taskId: string, text: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? addSubtaskToTask(t, text) : t)));
  };

  const reorderSubtasks = (taskId: string, data: Subtask[]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, subtasks: data, updatedAt: Date.now() } : t))
    );
  };

  const startSubtaskEdit = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setSubtaskEditDraft(subtask.text);
  };

  const cancelSubtaskEdit = () => {
    setEditingSubtaskId(null);
    setSubtaskEditDraft('');
  };

  const saveSubtaskEdit = (taskId: string, subtaskId: string) => {
    const nextText = subtaskEditDraft.trim();
    if (!nextText) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updateSubtaskInTask(t, subtaskId, nextText) : t)));
    cancelSubtaskEdit();
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? toggleSubtaskInTask(t, subtaskId) : t)));
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? deleteSubtaskFromTask(t, subtaskId) : t)));
    if (editingSubtaskId === subtaskId) cancelSubtaskEdit();
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

  const moveToToday = (id: string) => {
    const today = todayStr();
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, forDay: today, isOverdue: false } : t)));
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

  const nowLocal = new Date();
  const endOfToday = new Date(nowLocal);
  endOfToday.setHours(23, 59, 59, 999);
  const isTodayStillGoing = nowLocal.getTime() <= endOfToday.getTime();

  const setTaskReminder = (id: string, reminderAt: number | null) => {
    setTasks((prev) => {
      const next = prev.map((t) => {
        if (t.id !== id) return t;
        const nextTask: Task = { ...t, reminderAt: reminderAt || null };
        if (reminderAt) {
          // Переносим задачу на тот день, который соответствует reminderAt (по локальному времени).
          const reminderDateStr = dayStrFromDateLocal(new Date(reminderAt));
          nextTask.forDay = reminderDateStr;
          nextTask.isOverdue = false;
        }
        // Любая смена напоминания — это изменение задачи.
        if ((t.reminderAt ?? null) !== (reminderAt ?? null)) {
          nextTask.updatedAt = Date.now();
        }
        return nextTask;
      });
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

  const setReminderTempByUser = (d: Date) => {
    setReminderTemp(d);
    setShowPastReminderWarning(d.getTime() <= Date.now());
  };

  useEffect(() => {
    if (editingTaskId) {
      if (!editingTask) {
        // Сбрасываем только если задачи уже загружены и такой нет (например, удалили). Пока tasks пустой — ждём загрузки, чтобы по тапу уведомления открылась карточка.
        if (tasks.length > 0) setEditingTaskId(null);
        return;
      }
      setEditDraft(editingTask.text ?? '');
      setSubtaskDraft('');
      cancelSubtaskEdit();
      const base =
        editingTask.reminderAt && editingTask.reminderAt > Date.now()
          ? new Date(editingTask.reminderAt)
          : new Date();
      setReminderTemp(base);
      setShowPastReminderWarning(false);
    } else {
      setEditDraft('');
      setSubtaskDraft('');
      cancelSubtaskEdit();
      setShowPastReminderWarning(false);
    }
  }, [editingTaskId, editingTask, tasks.length]);

  const closeEditModal = () => {
    if (editingTaskId && editDraft.trim() !== '') {
      updateTask(editingTaskId, editDraft);
    }
    cancelSubtaskEdit();
    setEditingTaskId(null);
    setReminderPickerOpen(false);
  };

  const emptyList = (
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
        <Pressable onPress={() => addInputRef.current?.focus()} style={[styles.primaryBtn, { backgroundColor: colors.accent }]}>
          <Text style={{ color: '#fff' }}>Создать дело</Text>
        </Pressable>
      )}
    </View>
  );

  const completedListFooter =
    completed.length > 0 ? (
      <View style={styles.doneWrap}>
        <Text style={[styles.doneTitle, { color: colors.muted }]}>Готово</Text>
        {completed.map((t) => (
          <Swipeable
            key={t.id}
            overshootLeft={false}
            leftThreshold={56}
            renderLeftActions={() => <View style={styles.hiddenSwipeAction} />}
            onSwipeableOpen={(direction, swipeable) => {
              swipeable.close();
              if (direction === 'left') deleteTask(t.id);
            }}>
            <Pressable
              onPress={() => setEditingTaskId(t.id)}
              style={[
                styles.taskRow,
                listMode === 'compact' ? styles.taskRowCompact : styles.taskRowExpanded,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.75 },
              ]}>
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  toggleTask(t.id);
                }}
                style={[
                  styles.check,
                  listMode === 'compact' ? styles.checkCompact : styles.checkExpanded,
                  { borderColor: checkBorderColor, backgroundColor: checkBgColor },
                ]}>
                <Text style={{ color: colors.text }}>✓</Text>
              </Pressable>
              <View style={styles.taskTextCol}>
                <Text
                  style={[styles.taskText, { color: colors.text, textDecorationLine: 'line-through' }]}
                  numberOfLines={listMode === 'compact' ? 5 : 8}>
                  {parseLinksAndPhones(t.text).map((seg, i) =>
                    seg.type === 'text' ? (
                      <Text key={i} style={{ color: colors.text, textDecorationLine: 'line-through' }}>
                        {seg.value}
                      </Text>
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
                {renderTaskDatesMeta(t)}
              </View>
            </Pressable>
          </Swipeable>
        ))}
      </View>
    ) : null;

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
              <Pressable
                onPress={() => setFocusMode((v) => !v)}
                style={[styles.iconBtn, { backgroundColor: focusMode ? colors.accent : colors.surface }]}>
                <Ionicons name="radio-button-on-outline" size={22} color={focusMode ? '#fff' : colors.text} />
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

        <View style={[styles.body, { paddingBottom: footerPad }]}>
          <View style={[styles.searchWrap, { backgroundColor: colors.bg }]}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск по делам..."
              placeholderTextColor={colors.muted}
              style={[styles.search, { backgroundColor: colors.surface, color: colors.text }]}
            />
          </View>

          {Platform.OS === 'web' ? (
            <FlatList
              data={incomplete}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <TaskRow item={item} />}
              ListEmptyComponent={emptyList}
              ListFooterComponent={completedListFooter}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: footerPad }}
            />
          ) : (
            <DraggableFlatList
              data={incomplete}
              keyExtractor={(item) => item.id}
              onDragEnd={(p) => reorderTasks(p, currentDayStr)}
              renderItem={(p: RenderItemParams<Task>) => <TaskRow {...p} />}
              ListEmptyComponent={emptyList}
              ListFooterComponent={completedListFooter}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: footerPad }}
            />
          )}
        </View>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
              bottom: footerBottom,
              paddingBottom: footerPaddingBottom,
            },
          ]}>
          <TextInput
            ref={addInputRef}
            value={newTaskText}
            onChangeText={(t) => {
              newTaskTextRef.current = t;
              setNewTaskText(t);
            }}
            placeholder={
              dayView === 'tomorrow'
                ? 'Добавить дело на завтра…'
                : isDayStr(dayView)
                  ? 'Добавить дело на выбранный день…'
                  : 'Добавить дело…'
            }
            placeholderTextColor={colors.muted}
            editable={canCreateTasksForSelectedDay}
            style={[
              styles.addInput,
              { backgroundColor: colors.surface, color: colors.text, opacity: canCreateTasksForSelectedDay ? 1 : 0.55 },
            ]}
            onSubmitEditing={(e) => {
              if (!canCreateTasksForSelectedDay) return;
              const v = (e.nativeEvent.text ?? newTaskTextRef.current ?? '').trim();
              if (!v) return;
              addTask(v);
              newTaskTextRef.current = '';
              setNewTaskText('');
            }}
            returnKeyType="done"
          />
          <Pressable
            disabled={!canCreateTasksForSelectedDay}
            style={[styles.addBtn, { backgroundColor: colors.accent, opacity: canCreateTasksForSelectedDay ? 1 : 0.55 }]}
            onPress={() => {
              if (!canCreateTasksForSelectedDay) return;
              const v = (newTaskTextRef.current || newTaskText || '').trim();
              if (!v) return;
              addTask(v);
              newTaskTextRef.current = '';
              setNewTaskText('');
            }}>
            <Text style={{ color: '#fff', fontSize: 22, lineHeight: 22 }}>+</Text>
          </Pressable>
        </View>

        <CalendarModal
          visible={calendarOpen}
          colors={colors}
          markedDates={markedDates}
          onClose={() => setCalendarOpen(false)}
          onSelectDay={(day) => {
            setDayView(day);
            setCalendarOpen(false);
          }}
        />

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
                              <Pressable
                                key={n.id}
                                onPress={() =>
                                  openFromInAppNotification({
                                    requestId: n.requestId,
                                    taskId: n.taskId,
                                  })
                                }
                                style={[styles.slotRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                                <Text style={{ color: colors.text, flex: 1 }} numberOfLines={2}>
                                  {n.text}
                                </Text>
                                <Text style={{ color: colors.muted }}>
                                  {new Date(n.firedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                              </Pressable>
                        ))}
                        <Pressable
                          onPress={() => {
                            setReminderNotifications([]);
                            Notifications.setBadgeCountAsync(0).catch(() => {});
                          }}
                          style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}
                        >
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
                          themeVariant={resolvedTheme}
                          {...(Platform.OS === 'ios' ? { textColor: dateTimePickerTextColor } : {})}
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
                        <Text style={{ color: colors.muted, fontSize: 12 }}>Версия {versionLabel}</Text>
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
                <Pressable
                  onPress={closeEditModal}
                  hitSlop={14}
                  style={{ padding: 8, marginRight: -8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Закрыть"
                >
                  <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>
              <EditScrollContainer
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 24 + keyboardHeight }}
                showsVerticalScrollIndicator={false}>
              <TextInput
                value={editDraft}
                onChangeText={setEditDraft}
                multiline
                style={[
                  styles.editInput,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: settings?.editorFontSize ?? 15,
                    lineHeight: Math.round((settings?.editorFontSize ?? 15) * 1.35),
                  },
                ]}
              />
              <View style={[styles.row, { marginTop: 10, justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Размер текста</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() =>
                      setSettingsState((s) => {
                        if (!s) return s;
                        const cur = s.editorFontSize ?? 15;
                        return { ...s, editorFontSize: Math.max(12, cur - 1) };
                      })
                    }
                    style={[styles.chip, { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: colors.text }}>A-</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setSettingsState((s) => {
                        if (!s) return s;
                        const cur = s.editorFontSize ?? 15;
                        return { ...s, editorFontSize: Math.min(24, cur + 1) };
                      })
                    }
                    style={[styles.chip, { backgroundColor: colors.surface }]}
                  >
                    <Text style={{ color: colors.text }}>A+</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.muted }]}>ПОДДЕЛА</Text>
              {(() => {
                const list = editingTask?.subtasks ?? [];
                const taskId = editingTask?.id;
                const renderSubtaskRow = (st: Subtask, drag?: () => void, isActive = false) => {
                  if (!taskId) return null;
                  const isEditing = editingSubtaskId === st.id;
                  return (
                    <Pressable
                      key={st.id}
                      onLongPress={Platform.OS === 'web' || isEditing ? undefined : drag}
                      delayLongPress={180}
                      style={[
                        styles.slotRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          opacity: isActive ? 0.82 : st.done && !isEditing ? 0.72 : 1,
                        },
                      ]}>
                      <Pressable
                        onPress={() => toggleSubtask(taskId, st.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{
                          width: 44,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: st.done }}
                        accessibilityLabel={st.done ? 'Отметить невыполненным' : 'Отметить выполненным'}>
                        <Text
                          style={{
                            color: st.done ? colors.accent : colors.text,
                            fontSize: 28,
                            lineHeight: 30,
                          }}>
                          {st.done ? '☑' : '☐'}
                        </Text>
                      </Pressable>
                      {isEditing ? (
                        <TextInput
                          value={subtaskEditDraft}
                          onChangeText={setSubtaskEditDraft}
                          autoFocus
                          multiline
                          style={[styles.addInput, { flex: 1, backgroundColor: colors.bg, color: colors.text, minHeight: 44 }]}
                          returnKeyType="done"
                          onSubmitEditing={() => saveSubtaskEdit(taskId, st.id)}
                        />
                      ) : (
                        <Pressable
                          onPress={() => startSubtaskEdit(st)}
                          style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}
                          accessibilityRole="button"
                          accessibilityLabel="Редактировать поддело">
                          <Text
                            style={{
                              color: st.done ? colors.muted : colors.text,
                              textDecorationLine: st.done ? 'line-through' : 'none',
                              fontSize: 15,
                            }}
                            numberOfLines={2}>
                            {st.text}
                          </Text>
                        </Pressable>
                      )}
                      {isEditing ? (
                        <>
                          <Pressable onPress={() => saveSubtaskEdit(taskId, st.id)} hitSlop={10}>
                            <Text style={{ color: colors.accent, fontSize: 18 }}>✓</Text>
                          </Pressable>
                          <Pressable onPress={cancelSubtaskEdit} hitSlop={10}>
                            <Text style={{ color: colors.muted, fontSize: 18 }}>×</Text>
                          </Pressable>
                        </>
                      ) : (
                        <>
                          <Pressable onPress={() => startSubtaskEdit(st)} hitSlop={10}>
                            <Text style={{ color: colors.muted }}>✎</Text>
                          </Pressable>
                          <Pressable onPress={() => deleteSubtask(taskId, st.id)} hitSlop={10}>
                            <Text style={{ color: colors.muted }}>🗑️</Text>
                          </Pressable>
                        </>
                      )}
                    </Pressable>
                  );
                };
                return (
                  <View style={{ gap: 8 }}>
                    {list.length === 0 ? (
                      <Text style={{ color: colors.muted }}>Пока нет поддел.</Text>
                    ) : taskId ? (
                      Platform.OS === 'web' ? (
                        <View style={{ gap: 8 }}>{list.map((st) => renderSubtaskRow(st))}</View>
                      ) : (
                        <NestableDraggableFlatList
                          data={list}
                          keyExtractor={(st) => st.id}
                          scrollEnabled={false}
                          activationDistance={12}
                          onDragEnd={({ data }) => reorderSubtasks(taskId, data)}
                          renderItem={({ item: st, drag, isActive }: RenderItemParams<Subtask>) => renderSubtaskRow(st, drag, isActive)}
                        />
                      )
                    ) : null}

                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                      <TextInput
                        value={subtaskDraft}
                        onChangeText={setSubtaskDraft}
                        placeholder="Добавить поддело…"
                        placeholderTextColor={colors.muted}
                        style={[styles.addInput, { flex: 1, backgroundColor: colors.surface, color: colors.text }]}
                        onSubmitEditing={(e) => {
                          const v = (e.nativeEvent.text ?? subtaskDraft).trim();
                          if (!v) return;
                          addSubtask(editingTask!.id, v);
                          setSubtaskDraft('');
                        }}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={[styles.addBtn, { backgroundColor: colors.accent }]}
                        onPress={() => {
                          const v = subtaskDraft.trim();
                          if (!v) return;
                          addSubtask(editingTask!.id, v);
                          setSubtaskDraft('');
                        }}>
                        <Text style={{ color: '#fff', fontSize: 18, lineHeight: 18 }}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })()}
              <Text style={[styles.sectionTitle, { color: colors.muted }]}>ПОВТОР</Text>
              <View style={styles.row}>
                {([
                  ['none', 'Не повторять'],
                  ['daily', 'Каждый день'],
                  ['weekdays', 'Будни'],
                  ['weekly', 'Раз в неделю'],
                ] as const).map(([rule, label]) => {
                  const active = (editingTask?.repeatRule ?? 'none') === rule;
                  return (
                    <Pressable
                      key={rule}
                      onPress={() => {
                        if (!editingTaskId) return;
                        setTaskRepeatRule(editingTaskId, rule);
                      }}
                      style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surface }]}>
                      <Text style={{ color: active ? '#fff' : colors.text }}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: pickerLabelColor, fontSize: 12, marginTop: 4 }}>
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
                    <Text style={[styles.sectionTitle, { color: pickerLabelColor, marginTop: 0 }]}>День</Text>
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
                            setReminderTempByUser(d);
                          }}
                          style={[styles.chip, { backgroundColor: dayMode === label ? colors.accent : colors.surface }]}>
                          <Text style={{ color: dayMode === label ? '#fff' : colors.text }}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={[styles.sectionTitle, { color: pickerLabelColor }]}>Время</Text>
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
                            setReminderTempByUser(d);
                          }}
                          style={[styles.chip, { backgroundColor: timePreset === p.label ? colors.accent : colors.surface }]}>
                          <Text style={{ color: timePreset === p.label ? '#fff' : colors.text }}>{p.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })()}
              {showPastReminderWarning && reminderTemp.getTime() <= Date.now() && (
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
                    if (ts <= now) {
                      setShowPastReminderWarning(true);
                      return;
                    }
                    setTaskReminder(id, ts);
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
                    themeVariant={resolvedTheme}
                    textColor={dateTimePickerTextColor}
                    onChange={(_, date) => {
                      if (date) setReminderTempByUser(date);
                    }}
                  />
                  <View style={[styles.row, { marginTop: 10 }]}>
                    <Pressable
                      onPress={() => {
                        const ts = reminderTemp.getTime();
                        setReminderPickerOpen(false);
                        if (ts <= Date.now()) {
                          setShowPastReminderWarning(true);
                          return;
                        }
                        setTaskReminder(editingTaskId!, ts);
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
                    themeVariant={resolvedTheme}
                    onChange={(event: DateTimePickerEvent, date?: Date) => {
                      if (event.type === 'dismissed') {
                        setReminderPickerOpen(false);
                        return;
                      }
                      if (date) setReminderTempByUser(date);
                      if (reminderAndroidMode === 'date') {
                        setReminderAndroidMode('time');
                      } else {
                        const ts = (date ?? reminderTemp).getTime();
                        setReminderPickerOpen(false);
                        if (ts <= Date.now()) {
                          setShowPastReminderWarning(true);
                        } else {
                          setTaskReminder(editingTaskId!, ts);
                        }
                        setReminderAndroidMode('date');
                      }
                    }}
                  />
                </View>
              )}

              </EditScrollContainer>
            </View>
          </View>
        </Modal>

        <ConfirmDeleteModal
          visible={!!confirmDeleteTaskId}
          colors={colors}
          dontAskDeleteAgain={dontAskDeleteAgain}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmDeleteTaskId(null)}
          onToggleDontAsk={() => setDontAskDeleteAgain((v) => !v)}
        />

        <PostponeTaskModal
          task={postponeTask}
          colors={colors}
          onClose={() => setPostponeModalTaskId(null)}
          onPostponeTask={postponeToTomorrow}
          onSetReminder={setTaskReminder}
          onEditReminder={(taskId) => {
            setEditingTaskId(taskId);
            setReminderPickerOpen(true);
            setReminderAndroidMode('date');
          }}
        />

        <ThankYouToast visible={thankYouVisible} accentColor={colors.accent} />
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
  hiddenSwipeAction: { width: 1, opacity: 0 },
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
  checkCompact: { width: 24, height: 24, marginTop: 1 },
  checkExpanded: { width: 28, height: 28, marginTop: 3 },
  taskTextCol: { flex: 1, gap: 4, minWidth: 0 },
  taskText: { fontSize: 15, lineHeight: 20 },
  taskMeta: { fontSize: 12 },
  taskRowActions: { flexShrink: 0, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2, maxWidth: '34%' },
  tomorrowChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, minHeight: 38, justifyContent: 'center' },
  focusChip: {
    minWidth: 38,
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  smallBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  empty: { padding: 24, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyHint: { fontSize: 13, textAlign: 'center' },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center' },
  doneWrap: { paddingTop: 10, paddingBottom: 12 },
  doneTitle: { marginLeft: 16, marginTop: 8, marginBottom: 4, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
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

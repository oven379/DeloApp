import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task } from '../src/types';

interface Deps {
  tasks: Task[];
  updateTask: (id: string, text: string) => void;
  cancelSubtaskEdit: () => void;
}

export function useTaskEditing({ tasks, updateTask, cancelSubtaskEdit }: Deps) {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [reminderPickerOpen, setReminderPickerOpen] = useState(false);
  const [reminderTemp, setReminderTemp] = useState<Date>(new Date());
  const [showPastReminderWarning, setShowPastReminderWarning] = useState(false);
  const [reminderAndroidMode, setReminderAndroidMode] = useState<'date' | 'time'>('date');

  // Ref нужен для handleNotificationOpen (стейбл-колбэк без зависимости от editingTaskId)
  const editingTaskIdRef = useRef<string | null>(null);
  const editingTaskInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    editingTaskIdRef.current = editingTaskId;
  }, [editingTaskId]);

  const editingTask = tasks.find((t) => t.id === editingTaskId) ?? null;

  // Инициализируем черновик только при первом открытии конкретной задачи.
  // Изменения содержимого задачи (toggle подзадачи и т.п.) не вызывают сброс.
  useEffect(() => {
    if (!editingTaskId) {
      editingTaskInitializedRef.current = null;
      setEditDraft('');
      setSubtaskDraft('');
      cancelSubtaskEdit();
      setShowPastReminderWarning(false);
      return;
    }
    if (!editingTask) return;
    if (editingTaskInitializedRef.current === editingTaskId) return;
    editingTaskInitializedRef.current = editingTaskId;

    setEditDraft(editingTask.text ?? '');
    setSubtaskDraft('');
    cancelSubtaskEdit();
    const base =
      editingTask.reminderAt && editingTask.reminderAt > Date.now()
        ? new Date(editingTask.reminderAt)
        : new Date();
    setReminderTemp(base);
    setShowPastReminderWarning(false);
  }, [editingTaskId, editingTask, cancelSubtaskEdit]);

  // Закрываем модал если задача удалена пока была открыта
  useEffect(() => {
    if (editingTaskId && !editingTask && tasks.length > 0) {
      setEditingTaskId(null);
    }
  }, [editingTask, editingTaskId, tasks.length]);

  const setReminderTempByUser = useCallback((d: Date) => {
    setReminderTemp(d);
    setShowPastReminderWarning(d.getTime() <= Date.now());
  }, []);

  const closeEditModal = useCallback(() => {
    if (editingTaskId && editDraft.trim() !== '') {
      updateTask(editingTaskId, editDraft);
    }
    cancelSubtaskEdit();
    setEditingTaskId(null);
    setReminderPickerOpen(false);
  }, [editingTaskId, editDraft, updateTask, cancelSubtaskEdit]);

  return {
    editingTask,
    editingTaskId,
    setEditingTaskId,
    editingTaskIdRef,
    editDraft,
    setEditDraft,
    subtaskDraft,
    setSubtaskDraft,
    reminderPickerOpen,
    setReminderPickerOpen,
    reminderTemp,
    setReminderTemp,
    showPastReminderWarning,
    setShowPastReminderWarning,
    reminderAndroidMode,
    setReminderAndroidMode,
    setReminderTempByUser,
    closeEditModal,
  };
}

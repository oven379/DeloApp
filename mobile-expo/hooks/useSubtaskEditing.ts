import { useCallback, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Subtask, Task } from '../src/types';
import { updateSubtaskInTask } from '../src/lib/tasks';

export function useSubtaskEditing({ setTasks }: { setTasks: Dispatch<SetStateAction<Task[]>> }) {
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [subtaskEditDraft, setSubtaskEditDraft] = useState('');
  // Ref гарантирует что saveSubtaskEdit всегда читает актуальный текст,
  // даже если React ещё не успел применить батч рендеров.
  const subtaskEditDraftRef = useRef('');

  const handleSubtaskDraftChange = useCallback((text: string) => {
    subtaskEditDraftRef.current = text;
    setSubtaskEditDraft(text);
  }, []);

  const startSubtaskEdit = useCallback((subtask: Subtask) => {
    subtaskEditDraftRef.current = subtask.text;
    setSubtaskEditDraft(subtask.text);
    setEditingSubtaskId(subtask.id);
  }, []);

  const cancelSubtaskEdit = useCallback(() => {
    setEditingSubtaskId(null);
    subtaskEditDraftRef.current = '';
    setSubtaskEditDraft('');
  }, []);

  const saveSubtaskEdit = useCallback(
    (taskId: string, subtaskId: string) => {
      const nextText = subtaskEditDraftRef.current.trim();
      if (!nextText) return;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? updateSubtaskInTask(t, subtaskId, nextText) : t))
      );
      cancelSubtaskEdit();
    },
    [setTasks, cancelSubtaskEdit]
  );

  return {
    editingSubtaskId,
    subtaskEditDraft,
    setSubtaskEditDraft: handleSubtaskDraftChange,
    startSubtaskEdit,
    cancelSubtaskEdit,
    saveSubtaskEdit,
  };
}

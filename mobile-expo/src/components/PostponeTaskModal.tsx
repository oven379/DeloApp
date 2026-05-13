import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Task } from '../types';

type Palette = {
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
};

type Props = {
  task: Task | null;
  colors: Palette;
  onClose: () => void;
  onPostponeTask: (taskId: string) => void;
  onSetReminder: (taskId: string, reminderAt: number | null) => void;
  onEditReminder: (taskId: string) => void;
};

export function PostponeTaskModal({ task, colors, onClose, onPostponeTask, onSetReminder, onEditReminder }: Props) {
  const postponeWithReminder = () => {
    if (task) {
      onPostponeTask(task.id);
      const ts = task.reminderAt;
      if (ts) {
        const d = new Date(ts);
        d.setDate(d.getDate() + 1);
        onSetReminder(task.id, d.getTime());
      }
    }
    onClose();
  };

  const postponeOnlyTask = () => {
    if (task) onPostponeTask(task.id);
    onClose();
  };

  const editReminder = () => {
    if (task) onEditReminder(task.id);
    onClose();
  };

  return (
    <Modal visible={!!task} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {task?.reminderAt ? 'У дела есть напоминание сегодня' : 'Перенести на завтра?'}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8 }}>
            {task?.reminderAt ? 'Если перенести дело на завтра, что сделать с напоминанием?' : 'Дело будет перенесено на завтра.'}
          </Text>
          <Pressable onPress={postponeWithReminder} style={[styles.primaryBtn, { backgroundColor: colors.accent, marginTop: 14 }]}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Завтра</Text>
          </Pressable>
          {task?.reminderAt ? (
            <View style={[styles.row, { marginTop: 10 }]}>
              <Pressable onPress={postponeOnlyTask} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                <Text style={{ color: colors.text }}>Только дело</Text>
              </Pressable>
              <Pressable onPress={editReminder} style={[styles.primaryBtn, { backgroundColor: colors.surface2 }]}>
                <Text style={{ color: colors.text }}>Изменить</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  confirmBox: { margin: 24, borderRadius: 18, padding: 16, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, alignItems: 'center' },
});

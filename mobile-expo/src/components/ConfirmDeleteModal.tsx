import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Palette = {
  surface: string;
  surface2: string;
  text: string;
  border: string;
  overdue: string;
};

type Props = {
  visible: boolean;
  colors: Palette;
  dontAskDeleteAgain: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onToggleDontAsk: () => void;
};

export function ConfirmDeleteModal({
  visible,
  colors,
  dontAskDeleteAgain,
  onConfirm,
  onCancel,
  onToggleDontAsk,
}: Props) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={[styles.overlay, { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.confirmBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>Задачу нельзя будет восстановить.</Text>
          <Text style={{ color: colors.text, fontSize: 16, marginTop: 8 }}>Удалить?</Text>
          <View style={[styles.row, { marginTop: 14 }]}>
            <Pressable onPress={onConfirm} style={[styles.primaryBtn, { backgroundColor: colors.overdue, flex: 1 }]}>
              <Text style={{ color: '#fff' }}>Удалить</Text>
            </Pressable>
            <Pressable onPress={onCancel} style={[styles.primaryBtn, { backgroundColor: colors.surface2, flex: 1 }]}>
              <Text style={{ color: colors.text }}>Отмена</Text>
            </Pressable>
          </View>
          <Pressable onPress={onToggleDontAsk} style={styles.checkboxRow}>
            <Text style={{ color: colors.text }}>{dontAskDeleteAgain ? '☑' : '☐'}</Text>
            <Text style={{ color: colors.text }}>Больше не спрашивать (3 дня)</Text>
          </Pressable>
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
});

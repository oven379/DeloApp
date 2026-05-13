import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarList } from 'react-native-calendars';
import type { MarkedDates } from 'react-native-calendars/src/types';

import type { DayStr } from '../types';

type Palette = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
};

type Props = {
  visible: boolean;
  colors: Palette;
  markedDates: MarkedDates;
  onClose: () => void;
  onSelectDay: (day: DayStr) => void;
};

export function CalendarModal({ visible, colors, markedDates, onClose, onSelectDay }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, styles.calendarSheet, { backgroundColor: colors.bg, height: '85%', overflow: 'hidden' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Планы на день</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.muted, fontSize: 18 }}>✕</Text>
            </Pressable>
          </View>
          <View style={[styles.calendarListWrap, { overflow: 'hidden' }]}>
            <CalendarList
              pastScrollRange={24}
              futureScrollRange={36}
              onDayPress={(d) => onSelectDay(d.dateString as DayStr)}
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
            <Text style={{ color: colors.muted, fontSize: 12 }}>Красная точка — до даты остаётся меньше 7 дней.</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Зелёная — до даты остаётся 7 дней и больше.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});

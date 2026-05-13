import { StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  accentColor: string;
};

export function ThankYouToast({ visible, accentColor }: Props) {
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay]} pointerEvents="none">
      <View style={[styles.toast, { backgroundColor: accentColor }]}>
        <Text style={styles.text}>Отлично!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { justifyContent: 'center', alignItems: 'center' },
  toast: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 999 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

import 'react-native-gesture-handler';
import 'react-native-reanimated';

// expo-router иногда трактует файлы в папке `app/` как маршруты.
// Чтобы не было предупреждения про отсутствие default export, отдаём заглушку.
export default function Init() {
  return null;
}

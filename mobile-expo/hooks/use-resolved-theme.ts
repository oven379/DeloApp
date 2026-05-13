import { useColorScheme } from 'react-native';

import type { Settings } from '../src/types';

export function useResolvedTheme(theme: Settings['theme']) {
  const system = useColorScheme();
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  return system ?? 'dark';
}

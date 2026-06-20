import { useColorScheme } from 'react-native';

import { useAppState } from './state/AppStateContext';
import { darkColors, lightColors, type Palette } from './theme';

// 현재 테마 모드(다크/라이트/시스템)에 맞는 팔레트 반환.
export function useColors(): Palette {
  const { state } = useAppState();
  const system = useColorScheme(); // 'light' | 'dark' | null
  const mode = state.theme === 'system' ? system ?? 'dark' : state.theme;
  return mode === 'light' ? lightColors : darkColors;
}

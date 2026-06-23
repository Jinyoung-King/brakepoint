import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type FsiPermissionModule = { canUseFullScreenIntent(): boolean };

const mod = requireOptionalNativeModule<FsiPermissionModule>('FsiPermission');

// 잠금화면 위 통화(풀스크린 인텐트)를 띄울 수 있는 권한이 켜져 있는지.
// Android 13 이하 / 모듈 미탑재 / iOS 에서는 항상 true (제한 없음).
export function canUseFullScreenIntent(): boolean {
  if (Platform.OS !== 'android' || !mod) return true;
  try {
    return mod.canUseFullScreenIntent();
  } catch {
    return true;
  }
}

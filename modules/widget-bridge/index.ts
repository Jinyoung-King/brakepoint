import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type WidgetBridgeModule = { updateWidget(count: number, limit: number): void };

const mod =
  Platform.OS === 'android' ? requireOptionalNativeModule<WidgetBridgeModule>('WidgetBridge') : null;

export const widgetAvailable = !!mod;

// 홈 위젯에 현재 잔/한계 반영. 모듈 미탑재/iOS면 no-op.
export function updateWidget(count: number, limit: number): void {
  if (!mod) return;
  try {
    mod.updateWidget(count, limit);
  } catch {
    // 무시
  }
}

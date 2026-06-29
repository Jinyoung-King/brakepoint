import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type WidgetBridgeModule = {
  updateWidget(count: number, limit: number, theme: string): void;
  consumePendingAdd(): number;
};

const mod =
  Platform.OS === 'android' ? requireOptionalNativeModule<WidgetBridgeModule>('WidgetBridge') : null;

export const widgetAvailable = !!mod;

// 홈 위젯에 현재 잔/한계/테마 반영. 모듈 미탑재/iOS면 no-op.
export function updateWidget(count: number, limit: number, theme: string): void {
  if (!mod) return;
  try {
    mod.updateWidget(count, limit, theme);
  } catch {
    // 무시
  }
}

// 위젯 "+1"로 쌓인 미반영 횟수를 가져오고 리셋. 없으면 0.
export function consumePendingWidgetAdds(): number {
  if (!mod) return 0;
  try {
    return mod.consumePendingAdd();
  } catch {
    return 0;
  }
}

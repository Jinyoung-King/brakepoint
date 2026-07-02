import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type WidgetBridgeModule = {
  updateWidget(std: number, limit: number, perDrinkStd: number, theme: string): void;
  consumePendingAdd(): number;
};

const mod =
  Platform.OS === 'android' ? requireOptionalNativeModule<WidgetBridgeModule>('WidgetBridge') : null;

export const widgetAvailable = !!mod;

// 홈 위젯에 현재 취기 상태를 반영. 모듈 미탑재/iOS면 no-op.
// - std: 누적 표준잔(순알코올/8g). 홈 게이지와 동일한 "취기" 기준.
// - limit: 한도(표준잔). 취기% = std/limit.
// - perDrinkStd: 현재 주종 한 잔이 더해질 때 늘어나는 표준잔 (위젯 "+1" 낙관적 갱신용).
export function updateWidget(std: number, limit: number, perDrinkStd: number, theme: string): void {
  if (!mod) return;
  try {
    mod.updateWidget(std, limit, perDrinkStd, theme);
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

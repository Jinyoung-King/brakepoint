import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type WearBridgeModule = {
  sendState(count: number, limit: number, bac: number): Promise<void>;
  addListener(event: 'onAddDrink', cb: (e: { n: number }) => void): { remove(): void };
};

const mod =
  Platform.OS === 'android' ? requireOptionalNativeModule<WearBridgeModule>('WearBridge') : null;

export const wearBridgeAvailable = !!mod;

// 워치에서 "+1잔"이 오면 콜백 호출. 미탑재/iOS면 no-op 구독 반환.
export function onWatchAddDrink(cb: (n: number) => void): { remove(): void } {
  if (!mod) return { remove() {} };
  try {
    return mod.addListener('onAddDrink', (e) => cb(e?.n ?? 1));
  } catch {
    return { remove() {} };
  }
}

// 현재 잔/한계/BAC를 워치로 전송. 실패는 조용히 무시.
export function sendStateToWatch(count: number, limit: number, bac: number): void {
  if (!mod) return;
  mod.sendState(count, limit, bac).catch(() => {});
}

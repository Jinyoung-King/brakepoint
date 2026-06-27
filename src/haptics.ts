import { Platform, Vibration } from 'react-native';

// RN 코어 Vibration 기반 가벼운 햅틱 (새 네이티브 모듈 없이 OTA 가능).
// iOS는 Vibration이 길게 울려 탭마다 거슬리므로 안드로이드에서만 작동.
const enabled = Platform.OS === 'android';

function buzz(ms: number) {
  if (!enabled) return;
  try {
    Vibration.vibrate(ms);
  } catch {
    // 진동 실패는 무시
  }
}

export const tapHaptic = () => buzz(8); // 탭 전환 등 가벼운 터치
export const addHaptic = () => buzz(16); // 잔 추가 등 확정 액션
export const successHaptic = () => buzz(28); // 성공/완료

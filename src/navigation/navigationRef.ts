import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './RootNavigator';

// 알림 탭 등 컴포넌트 밖에서 화면 전환하기 위한 전역 ref
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// 콜드 스타트(꺼진 화면→풀스크린 인텐트로 앱 실행) 시 getInitialNotification이
// 네비게이터가 준비되기 전에 resolve될 수 있다. 준비 전 요청은 버리지 말고 쌓아뒀다가
// onReady에서 흘려보낸다. (이게 없으면 통화 화면으로 못 넘어가고 Home에 머무름)
let pendingFakeCall = false;
let pendingGate = false;

export function navigateToFakeCall() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('FakeCall');
  } else {
    pendingFakeCall = true;
  }
}

// 상시 알림으로 잔 추가 → 브레이크 도달 시 인지게이트로 (콜드스타트 대비 pending).
export function navigateToGate() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('CognitiveGate');
  } else {
    pendingGate = true;
  }
}

// 알림 "종료" → 홈 탭으로 (홈은 콜드스타트 기본 화면이라 pending 불필요).
export function navigateToHome() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Main', { screen: 'Home' });
  }
}

// NavigationContainer onReady에서 호출.
export function flushPendingNavigation() {
  if (!navigationRef.isReady()) return;
  if (pendingFakeCall) {
    pendingFakeCall = false;
    navigationRef.navigate('FakeCall');
  }
  if (pendingGate) {
    pendingGate = false;
    navigationRef.navigate('CognitiveGate');
  }
}

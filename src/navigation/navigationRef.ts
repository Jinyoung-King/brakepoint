import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './RootNavigator';

// 알림 탭 등 컴포넌트 밖에서 화면 전환하기 위한 전역 ref
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

// 콜드 스타트(꺼진 화면→풀스크린 인텐트로 앱 실행) 시 getInitialNotification이
// 네비게이터가 준비되기 전에 resolve될 수 있다. 준비 전 요청은 버리지 말고 쌓아뒀다가
// onReady에서 흘려보낸다. (이게 없으면 통화 화면으로 못 넘어가고 Home에 머무름)
let pendingFakeCall = false;

export function navigateToFakeCall() {
  if (navigationRef.isReady()) {
    navigationRef.navigate('FakeCall');
  } else {
    pendingFakeCall = true;
  }
}

// NavigationContainer onReady에서 호출.
export function flushPendingNavigation() {
  if (pendingFakeCall && navigationRef.isReady()) {
    pendingFakeCall = false;
    navigationRef.navigate('FakeCall');
  }
}

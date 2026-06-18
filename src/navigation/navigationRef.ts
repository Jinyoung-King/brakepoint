import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './RootNavigator';

// 알림 탭 등 컴포넌트 밖에서 화면 전환하기 위한 전역 ref
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateToFakeCall() {
  if (navigationRef.isReady()) navigationRef.navigate('FakeCall');
}

import { registerRootComponent } from 'expo';
import notifee, { EventType } from '@notifee/react-native';

import App from './App';
import { ACT_DRINK, ACT_END, handleOngoingActionBg } from './src/ongoing';
import { ACT_MORNING, markPendingMorningCheckBg } from './src/morningCheck';
import { ACT_IDLE, markPendingEndBg } from './src/idleSession';

// notifee 백그라운드 이벤트 핸들러 (앱이 백그라운드/종료 상태일 때 호출됨).
// 가짜전화는 풀스크린 인텐트로 앱이 열리며 FakeCallController가 라우팅하므로 여기선 무시.
// 상시 알림의 "잔 +1"/"종료" 액션은 React 트리가 없을 수 있어 디스크 상태를 직접 갱신한다.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const id = detail.pressAction?.id;
  // 아침 컨디션 알림 탭(본문 press) → 디스크에 pending 플래그. 포그라운드 복귀 시 시트가 뜬다.
  if (type === EventType.PRESS && id === ACT_MORNING) {
    await markPendingMorningCheckBg();
    return;
  }
  // 방치 확인 알림 탭 → 종료(정리) 모달 플래그(pendingEnd).
  if (type === EventType.PRESS && id === ACT_IDLE) {
    await markPendingEndBg();
    return;
  }
  if (type !== EventType.ACTION_PRESS) return;
  if (id === ACT_DRINK || id === ACT_END) {
    await handleOngoingActionBg(id, Date.now());
  }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

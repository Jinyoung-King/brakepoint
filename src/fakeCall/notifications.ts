import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  TimeUnit,
  TriggerType,
  type Notification,
} from '@notifee/react-native';

import type { FakeCallConfig } from '../storage';

export const FAKE_CALL_CHANNEL = 'fake-call';
const FAKE_CALL_NOTIF_ID = 'fake-call'; // 고정 ID로 중복 방지/취소 용이

// 권한 + 통화용 채널 준비. 권한 허용 여부 반환.
export async function ensureNotificationSetup(): Promise<boolean> {
  const settings = await notifee.requestPermission();
  await notifee.createChannel({
    id: FAKE_CALL_CHANNEL,
    name: '가짜 전화',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
    bypassDnd: true,
  });
  // authorizationStatus >= 1 (AUTHORIZED/PROVISIONAL) 이면 허용
  return settings.authorizationStatus >= 1;
}

// 잠금화면 위 통화 UI를 띄우는 풀스크린 인텐트 알림 정의
function buildCallNotification(fakeCall: FakeCallConfig): Notification {
  return {
    id: FAKE_CALL_NOTIF_ID,
    title: fakeCall.callerName || '전화',
    body: `${fakeCall.callerNumber} 전화가 왔습니다`,
    data: { type: 'fakeCall' },
    android: {
      channelId: FAKE_CALL_CHANNEL,
      importance: AndroidImportance.HIGH,
      category: AndroidCategory.CALL,
      visibility: AndroidVisibility.PUBLIC,
      // 화면이 잠겨/꺼져 있으면 풀스크린으로, 아니면 헤드업으로 표시
      fullScreenAction: { id: 'default', launchActivity: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
      loopSound: true,
      autoCancel: false,
    },
  };
}

// 음주모드 ON: 주기마다 반복되는 가짜 전화 (notifee INTERVAL 최소 15분)
export async function scheduleFakeCalls(fakeCall: FakeCallConfig): Promise<void> {
  await cancelFakeCalls();
  await notifee.createTriggerNotification(buildCallNotification(fakeCall), {
    type: TriggerType.INTERVAL,
    interval: Math.max(15, fakeCall.periodMin),
    timeUnit: TimeUnit.MINUTES,
  });
}

// 테스트용: delaySec 후 한 번 울림 (잠금화면 테스트하려고 약간의 지연)
export async function triggerTestCall(fakeCall: FakeCallConfig, delaySec = 8): Promise<void> {
  await notifee.createTriggerNotification(buildCallNotification(fakeCall), {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + delaySec * 1000,
  });
}

export async function cancelFakeCalls(): Promise<void> {
  await notifee.cancelTriggerNotifications();
  await notifee.cancelAllNotifications();
}

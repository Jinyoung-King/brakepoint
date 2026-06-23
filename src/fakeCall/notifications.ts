import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  TimeUnit,
  TriggerType,
  type Notification,
} from '@notifee/react-native';
import * as IntentLauncher from 'expo-intent-launcher';

import type { FakeCallConfig } from '../storage';
import { confirmRationale } from '../permissionRationale';

export const FAKE_CALL_CHANNEL = 'fake-call';
const PACKAGE_NAME = 'kr.co.cruxdata.brakepoint'; // app.json android.package

// Android 14+는 USE_FULL_SCREEN_INTENT가 기본 차단이라 사용자가 직접 켜야 함.
// 해당 설정 화면으로 보냄. (실패 시 일반 알림 설정으로 폴백)
export async function openFullScreenIntentSettings(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
      { data: `package:${PACKAGE_NAME}` }
    );
  } catch {
    await notifee.openNotificationSettings();
  }
}
const FAKE_CALL_NOTIF_ID = 'fake-call'; // 고정 ID로 중복 방지/취소 용이

async function ensureCallChannel(): Promise<void> {
  await notifee.createChannel({
    id: FAKE_CALL_CHANNEL,
    name: '가짜 전화',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500],
    bypassDnd: true,
  });
}

// 권한 + 통화용 채널 준비. 권한 허용 여부 반환.
// 아직 허용 전이면 시스템 창을 띄우기 전에 왜 필요한지 먼저 설명한다.
export async function ensureNotificationSetup(): Promise<boolean> {
  const current = await notifee.getNotificationSettings();
  if (current.authorizationStatus < 1) {
    const ok = await confirmRationale(
      '알림 권한',
      '음주모드를 켜면 정해진 주기마다 "가짜 전화"가 와요. 이 알림을 띄우려면 알림 권한이 필요해요.'
    );
    if (!ok) {
      await ensureCallChannel();
      return false;
    }
  }
  const settings = await notifee.requestPermission();
  await ensureCallChannel();
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
  // id 단위로만 취소 (귀가 체크인 등 다른 예약 알림은 건드리지 않음)
  await notifee.cancelTriggerNotification(FAKE_CALL_NOTIF_ID);
  await notifee.cancelNotification(FAKE_CALL_NOTIF_ID);
}

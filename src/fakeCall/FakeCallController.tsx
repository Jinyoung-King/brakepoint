import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';

import { useAppState } from '../state/AppStateContext';
import { navigateToFakeCall } from '../navigation/navigationRef';
import {
  cancelFakeCalls,
  ensureNotificationSetup,
  scheduleFakeCalls,
  FAKE_CALL_NOTIF_ID,
} from './notifications';

const isFakeCall = (data: unknown) =>
  !!data && (data as { type?: string }).type === 'fakeCall';

// 표시 중인 가짜전화 알림이 있으면 통화화면으로 보내고 그 알림을 끈다.
// (백그라운드 앱이 풀스크린 인텐트로 깨어난 경우 PRESS/콜드스타트 둘 다 아니라서 이 경로가 필요)
async function routeIfFakeCallDisplayed() {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    if (displayed.some((n) => isFakeCall(n.notification?.data))) {
      navigateToFakeCall();
      await notifee.cancelDisplayedNotification(FAKE_CALL_NOTIF_ID);
    }
  } catch {
    // 조회 실패는 무시 (PRESS/콜드스타트 경로가 백업)
  }
}

// 화면을 그리지 않고, 음주모드/주기 변화에 따라 알림 예약·취소 + 알림→통화화면 라우팅.
export default function FakeCallController() {
  const { state, ready } = useAppState();
  const { drinkingMode, fakeCall } = state;

  // 알림이 눌리거나 풀스크린으로 앱이 열렸을 때 → 가짜 통화 화면
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && isFakeCall(detail.notification?.data)) {
        navigateToFakeCall();
      }
    });
    // 콜드 스타트(알림으로 앱이 켜진 경우)
    notifee.getInitialNotification().then((initial) => {
      if (initial && isFakeCall(initial.notification.data)) navigateToFakeCall();
    });
    return unsub;
  }, []);

  // 백그라운드 앱이 풀스크린 인텐트로 포그라운드로 올라온 경우: 마운트 시 + active 전환 시
  // 표시 중인 가짜전화 알림을 확인해 통화화면으로 라우팅.
  useEffect(() => {
    routeIfFakeCallDisplayed();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') routeIfFakeCallDisplayed();
    });
    return () => sub.remove();
  }, []);

  // 음주모드 ON → 주기마다 예약, OFF → 취소. 주기/발신자 변경 시 재예약.
  const period = fakeCall.periodMin;
  const callerName = fakeCall.callerName;
  const callerNumber = fakeCall.callerNumber;
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      if (drinkingMode) {
        const granted = await ensureNotificationSetup();
        if (!cancelled && granted) await scheduleFakeCalls(fakeCall);
      } else {
        await cancelFakeCalls();
      }
    })();
    return () => {
      cancelled = true;
    };
    // fakeCall 객체 대신 원시값을 의존성으로 (객체는 매 렌더 새로 생성됨)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drinkingMode, period, callerName, callerNumber]);

  return null;
}

import { useEffect, useRef } from 'react';
import notifee, { EventType } from '@notifee/react-native';

import { useAppState } from '../state/AppStateContext';
import { navigateToFakeCall } from '../navigation/navigationRef';
import { cancelFakeCalls, ensureNotificationSetup, scheduleFakeCalls } from './notifications';

const isFakeCall = (data: unknown) =>
  !!data && (data as { type?: string }).type === 'fakeCall';

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

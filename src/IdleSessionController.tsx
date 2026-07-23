import { useEffect, useRef } from 'react';
import { Alert, AppState as RNAppState } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';

import { useAppState } from './state/AppStateContext';
import { ACT_IDLE, cancelIdlePrompt, idleDueAt, scheduleIdlePrompt } from './idleSession';

// 술자리 방치 감지: 마지막 잔 후 idleEndMin 동안 잔이 늘지 않으면
// - 앱이 열려 있으면(포그라운드): idleAutoEnd면 자동 종료, 아니면 확인 창(pendingIdlePrompt)
// - 앱이 닫혀 있으면(백그라운드): 확인 알림을 예약, 탭하면 종료 모달(pendingEnd)
export default function IdleSessionController() {
  const { state, ready, endSession, setPendingIdlePrompt, setPendingEnd } = useAppState();
  const { idleAutoEnd, drinkingMode, count } = state;
  const dueAt = idleDueAt(state);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ready) return;
    const clearTimer = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    clearTimer();
    if (dueAt == null) {
      cancelIdlePrompt();
      return;
    }

    let fired = false;
    const fireForeground = () => {
      if (fired) return;
      fired = true;
      clearTimer();
      cancelIdlePrompt();
      if (idleAutoEnd) {
        endSession();
        Alert.alert('술자리 자동 정리', '한동안 조용해서 술자리를 기록에 저장하고 종료했어요.');
      } else {
        setPendingIdlePrompt(true);
      }
    };
    const check = () => {
      if (RNAppState.currentState !== 'active') return;
      if (Date.now() >= dueAt) fireForeground();
    };
    const startInterval = () => {
      if (!intervalRef.current) intervalRef.current = setInterval(check, 30000);
    };

    const onChange = (st: string) => {
      if (fired) return;
      if (st === 'active') {
        cancelIdlePrompt(); // 포그라운드에선 알림 대신 앱 내 확인
        check();
        startInterval();
      } else {
        clearTimer();
        scheduleIdlePrompt(dueAt, Date.now()); // 백그라운드: 알림으로 확인
      }
    };

    // 현재 상태에 맞춰 시작
    if (RNAppState.currentState === 'active') {
      cancelIdlePrompt();
      check();
      startInterval();
    } else {
      scheduleIdlePrompt(dueAt, Date.now());
    }
    const sub = RNAppState.addEventListener('change', onChange);
    return () => {
      clearTimer();
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, dueAt, idleAutoEnd, drinkingMode, count]);

  // 방치 알림 탭(포그라운드/백그라운드-alive) → 종료(정리) 모달.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
      if (detail.pressAction?.id === ACT_IDLE) {
        cancelIdlePrompt();
        setPendingEnd(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 콜드 스타트: 방치 알림 탭으로 앱이 켜진 경우.
  useEffect(() => {
    notifee.getInitialNotification().then((initial) => {
      if (initial?.pressAction?.id === ACT_IDLE) setPendingEnd(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

import { useEffect, useRef } from 'react';
import notifee, { EventType } from '@notifee/react-native';

import { useAppState } from './state/AppStateContext';
import {
  ACT_MORNING,
  cancelMorningCheck,
  scheduleMorningCheck,
} from './morningCheck';

// 최근 술자리로 인정할 시간 창(시간). 이 안에 종료된 기록이 있으면 다음날 아침 체크인 예약.
const RECENT_WINDOW_H = 12;

// 음주모드 켜짐→꺼짐 전이 시(귀가 체크인과 동일 지점) 다음날 아침 컨디션 알림을 예약한다.
// 방금 마신 기록이 없으면(창 밖) 예약하지 않는다. 알림 탭은 pendingMorningCheck로 흡수.
export default function MorningCheckController() {
  const { state, ready, setPendingMorningCheck } = useAppState();
  const { drinkingMode, morningCheckEnabled, morningCheckHour, history } = state;
  const prev = useRef(drinkingMode);

  useEffect(() => {
    if (!ready) return;
    const was = prev.current;
    prev.current = drinkingMode;
    if (drinkingMode) {
      cancelMorningCheck();
      return;
    }
    if (!was || !morningCheckEnabled) return;
    // 방금 종료한 실제 술자리가 있을 때만(빈 토글·오래된 기록 방어)
    const now = Date.now();
    const last = history[0];
    if (last && now - last.endedAt <= RECENT_WINDOW_H * 3600_000) {
      scheduleMorningCheck(now, morningCheckHour);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drinkingMode]);

  // 알림 탭(앱 포그라운드) → 컨디션 시트 열기 플래그.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.PRESS && type !== EventType.ACTION_PRESS) return;
      if (detail.pressAction?.id === ACT_MORNING) setPendingMorningCheck(true);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 콜드 스타트: 아침 알림 탭으로 앱이 켜진 경우.
  useEffect(() => {
    notifee.getInitialNotification().then((initial) => {
      if (initial?.pressAction?.id === ACT_MORNING) setPendingMorningCheck(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

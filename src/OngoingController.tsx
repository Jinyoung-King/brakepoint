import { useEffect, useRef } from 'react';
import notifee, { EventType } from '@notifee/react-native';

import { useAppState } from './state/AppStateContext';
import type { AppState } from './storage';
import {
  ACT_DRINK,
  ACT_END,
  cancelGateAlert,
  cancelOngoing,
  displayOngoing,
} from './ongoing';
import { brakeCountsFor, crossesBrake } from './brake';
import { notifyWater } from './water';
import { navigateToGate, navigateToHome } from './navigation/navigationRef';

// 화면을 그리지 않고: 음주모드 동안 상시 알림을 띄우고, 알림 액션(잔 +1 / 종료)을
// 처리하며, 백그라운드 추가로 브레이크에 도달했으면(pendingGate) 인지게이트로 보낸다.
export default function OngoingController() {
  const { state, ready, addDrink, clearPendingGate, setPendingEnd } = useAppState();
  const { drinkingMode, ongoingNotifEnabled, count, limit, unit, drinkType, weightKg, sex, sessionStartMs } =
    state;

  // 포그라운드 액션 핸들러에서 최신 상태를 보기 위한 ref
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  // 음주모드 ON + 켜짐 → 상시 알림 표시/갱신, 아니면 제거.
  useEffect(() => {
    if (!ready) return;
    if (drinkingMode && ongoingNotifEnabled) {
      displayOngoing(state, Date.now());
    } else {
      cancelOngoing();
      cancelGateAlert();
    }
    // 잔/한도/BAC 입력이 바뀌면 알림 본문 갱신
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drinkingMode, ongoingNotifEnabled, count, limit, unit, drinkType, weightKg, sex, sessionStartMs]);

  // 알림 액션 처리 (앱이 포그라운드일 때). 백그라운드는 index.ts onBackgroundEvent.
  useEffect(() => {
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type !== EventType.ACTION_PRESS) return;
      const id = detail.pressAction?.id;
      if (id === ACT_DRINK) {
        const s = stateRef.current;
        if (!s.drinkingMode) return;
        const prev = s.count;
        const next = prev + 1;
        addDrink(1); // Context 경유 → 메모리 갱신 → 표시 effect가 알림 새로고침
        // 화면 탭과 동일하게 브레이크 지점이면 인지게이트 (단, 화면 밖이라 morning tighten 미적용)
        const brakeCounts = brakeCountsFor(s.limit, s.brakePercents);
        if (crossesBrake({ prev, next, limit: s.limit, brakeCounts, repeatEveryDrinks: s.repeatEveryDrinks })) {
          navigateToGate();
        } else if (s.waterEvery > 0 && Math.floor(prev / s.waterEvery) < Math.floor(next / s.waterEvery)) {
          notifyWater();
        }
      } else if (id === ACT_END) {
        setPendingEnd(true);
        navigateToHome();
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 콜드 스타트: "종료" 액션으로 앱이 켜진 경우 종료 모달 예약
  useEffect(() => {
    notifee.getInitialNotification().then((initial) => {
      if (initial?.pressAction?.id === ACT_END) setPendingEnd(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 백그라운드 추가로 브레이크 도달 → 앱 복귀(Context reload로 pendingGate=true 흡수) 시 게이트로.
  useEffect(() => {
    if (!ready) return;
    if (state.pendingGate && drinkingMode) {
      cancelGateAlert();
      navigateToGate();
      clearPendingGate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, state.pendingGate, drinkingMode]);

  return null;
}

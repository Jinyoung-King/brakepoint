import { useEffect, useRef } from 'react';

import { useAppState } from './state/AppStateContext';
import type { AppState } from './storage';
import { onWatchAddDrink, sendStateToWatch, wearBridgeAvailable } from '../modules/wear-bridge';
import { alcoholGrams, eventGrams, estimateBac } from './bac';
import { crossesBrakeOnAdd } from './brake';
import { navigateToGate } from './navigation/navigationRef';
import { notifyWater } from './water';
import { crossesWaterMark } from './waterMark';

// 화면을 그리지 않고: 워치의 "+1잔"을 받아 잔을 추가(브레이크/물 규칙 동일 적용)하고,
// 현재 잔/한계/BAC를 워치로 전송한다. 네이티브 모듈(wear-bridge) 없으면 전부 no-op.
export default function WearController() {
  const { state, ready, addDrink } = useAppState();
  const stateRef = useRef<AppState>(state);
  stateRef.current = state;

  // 워치 → 폰: 잔 추가 (화면 탭/알림과 동일하게 브레이크 지점이면 게이트, 물 알림)
  useEffect(() => {
    if (!wearBridgeAvailable) return;
    const sub = onWatchAddDrink((n) => {
      const s = stateRef.current;
      const prev = s.count;
      const next = prev + n;
      addDrink(n);
      // 브레이크는 표준잔(순알코올) 기준
      if (crossesBrakeOnAdd({ drinkEvents: s.drinkEvents, unit: s.unit, drinkType: s.drinkType, addN: n, limit: s.limit, brakePercents: s.brakePercents, repeatEveryDrinks: s.repeatEveryDrinks })) {
        navigateToGate();
      } else if (crossesWaterMark(prev, next, s.waterEvery, s.waterStartAt)) {
        notifyWater();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폰 → 워치: 상태 변화 시 현재 잔/한계/BAC 전송
  const { count, limit, unit, drinkType, weightKg, sex, sessionStartMs, drinkEvents } = state;
  useEffect(() => {
    if (!ready || !wearBridgeAvailable) return;
    const hoursSince = sessionStartMs ? (Date.now() - sessionStartMs) / 3600000 : 0;
    const grams = drinkEvents.length
      ? drinkEvents.reduce((a, e) => a + eventGrams(e, unit, drinkType), 0)
      : alcoholGrams(count, unit, drinkType);
    const bac = estimateBac({ grams, weightKg, sex, hoursSinceStart: hoursSince });
    sendStateToWatch(count, limit, bac);
  }, [ready, count, limit, unit, drinkType, weightKg, sex, sessionStartMs, drinkEvents]);

  return null;
}

// 상시 알림 액션(백그라운드 "+1잔"/"종료")의 순수 결정 로직 — 네이티브(notifee/storage) 의존성 없음.
// ongoing.ts의 헤드리스 핸들러가 이 플랜을 받아 저장/알림 IO만 수행한다(테스트 가능하게 분리).
import type { AppState } from './storage';
import { addDrink } from './state/reducers';
import { crossesBrakeOnAdd } from './brake';
import { crossesWaterMark } from './waterMark';

export const ACT_DRINK = 'ongoing-drink';
export const ACT_END = 'ongoing-end';

export type OngoingPlan = {
  save: AppState | null; // 저장할 다음 상태 (null이면 저장 안 함)
  notifyWater: boolean; // 물 헤드업 알림
  gate: boolean; // 인지게이트 알림(브레이크 도달)
  refreshOngoing: boolean; // 상시 알림 갱신
};

const NOOP: OngoingPlan = { save: null, notifyWater: false, gate: false, refreshOngoing: false };

// 백그라운드에선 "다음날 일정" 임계값 강화(morning tighten)를 알 수 없어 기본 brakePercents로 판정.
export function planOngoingAction(s: AppState, actionId: string, now: number): OngoingPlan {
  if (actionId === ACT_END) {
    // 종료는 앱을 열어 모달에서 처리 → 여기선 플래그만.
    return s.drinkingMode ? { ...NOOP, save: { ...s, pendingEnd: true } } : NOOP;
  }
  if (actionId !== ACT_DRINK || !s.drinkingMode) return NOOP;

  const prev = s.count;
  const next = prev + 1;
  const crossed = crossesBrakeOnAdd({
    drinkEvents: s.drinkEvents,
    unit: s.unit,
    drinkType: s.drinkType,
    addN: 1,
    limit: s.limit,
    brakePercents: s.brakePercents,
    repeatEveryDrinks: s.repeatEveryDrinks,
    customDrinks: s.customDrinks,
  });
  let ns = addDrink(s, 1, now);
  if (crossed) ns = { ...ns, pendingGate: true };
  return {
    save: ns,
    notifyWater: crossesWaterMark(prev, next, ns.waterEvery, ns.waterStartAt),
    gate: crossed,
    refreshOngoing: true,
  };
}

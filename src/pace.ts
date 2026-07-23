import type { CustomDrink, DrinkEvent, DrinkType, DrinkUnit } from './storage';
import { STD_GRAMS, eventGrams } from './bac';

// 음주 페이스(속도) 판정. drinkEvents 타임라인으로 "최근 한 시간 얼마나 빨리 마셨나"를 본다.
// 몸이 시간당 처리하는 순알코올은 대략 표준잔 1잔 정도 — 그 2배(기본 2잔/시간)를 넘으면 '빠름'.

export type PaceInfo = {
  stdLastHour: number; // 최근 windowMin 동안 마신 표준잔(순알코올 g / STD_GRAMS)
  minsSinceLast: number | null; // 마지막 잔 이후 경과(분). 이벤트 없으면 null
  fast: boolean; // 기준 페이스 초과 여부
};

export function drinkingPace(opts: {
  drinkEvents: DrinkEvent[];
  unit: DrinkUnit;
  drinkType: DrinkType;
  customDrinks?: CustomDrink[];
  now: number;
  windowMin?: number; // 페이스 측정 창(분). 기본 60분.
  fastPerHour?: number; // '빠름' 기준 표준잔/시간. 기본 2.
}): PaceInfo {
  const { drinkEvents, unit, drinkType, customDrinks = [], now } = opts;
  const windowMin = opts.windowMin ?? 60;
  const fastPerHour = opts.fastPerHour ?? 2;
  const windowStart = now - windowMin * 60000;

  let gramsInWindow = 0;
  let recentCount = 0; // 창 안의 잔 이벤트 수(페이스를 논하려면 최소 2잔은 필요)
  let lastT: number | null = null;
  for (const e of drinkEvents) {
    if (!Number.isFinite(e.t)) continue;
    if (lastT == null || e.t > lastT) lastT = e.t;
    if (e.t >= windowStart && e.t <= now) {
      gramsInWindow += eventGrams(e, unit, drinkType, customDrinks);
      recentCount += 1;
    }
  }

  // 창을 시간당으로 환산(창이 60분이면 그대로).
  const stdLastHour = (gramsInWindow / STD_GRAMS) * (60 / windowMin);
  const minsSinceLast = lastT == null ? null : Math.max(0, Math.round((now - lastT) / 60000));
  // 아직 마시는 중(마지막 잔이 창 안)이고, 창 안 2잔 이상이며, 시간당 환산이 기준을 넘으면 빠름.
  const fast =
    recentCount >= 2 && minsSinceLast != null && minsSinceLast <= windowMin && stdLastHour >= fastPerHour;

  return { stdLastHour, minsSinceLast, fast };
}

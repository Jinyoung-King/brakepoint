// 브레이크(인지게이트) 발동 지점 계산 — 순수 함수.
// HomeScreen 탭 추가와 상시 알림의 "잔 +1" 액션이 같은 규칙을 쓰도록 한 곳에 모은다.

// 다음날 일정이 있으면 임계값을 10%p 낮춰(최소 20%) 브레이크를 더 일찍 건다.
export function effectiveBrakePercents(brakePercents: number[], morningTighten: boolean): number[] {
  return morningTighten ? brakePercents.map((p) => Math.max(20, p - 10)) : brakePercents;
}

// 임계값(%)을 실제 잔수로 환산 (올림).
export function brakeCountsFor(limit: number, percents: number[]): number[] {
  return percents.map((p) => Math.ceil((limit * p) / 100));
}

// n잔째가 브레이크 지점인가 (고정 임계값 도달 또는 한계 초과 후 N잔마다).
export function isBrakeAt(opts: {
  n: number;
  limit: number;
  brakeCounts: number[];
  repeatEveryDrinks: number;
}): boolean {
  const { n, limit, brakeCounts, repeatEveryDrinks } = opts;
  if (limit <= 0) return false;
  const hitFixed = brakeCounts.includes(n);
  const repeat = n >= limit && (n - limit) % Math.max(1, repeatEveryDrinks) === 0;
  return hitFixed || repeat;
}

// prev→next로 잔을 더하는 구간에 브레이크 지점(정수 잔수)을 하나라도 넘으면 true.
// 반잔(0.5) 등 소수 스텝도 처리: prev 초과 ~ next 이하의 정수 N만 검사한다.
// (예: 2.5→3.0은 N=3을 새로 밟음, 3.0→3.5는 새 정수 없음)
export function crossesBrake(opts: {
  prev: number;
  next: number;
  limit: number;
  brakeCounts: number[];
  repeatEveryDrinks: number;
}): boolean {
  const { prev, next, limit, brakeCounts, repeatEveryDrinks } = opts;
  for (let k = Math.floor(prev) + 1; k <= next; k++) {
    if (isBrakeAt({ n: k, limit, brakeCounts, repeatEveryDrinks })) return true;
  }
  return false;
}

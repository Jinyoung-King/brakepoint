// 물 알림 발동 판정 (순수 함수 — 네이티브 의존성 없음). Home/ongoing/Ongoing/Wear가 공유.
// prev→next로 잔수가 늘 때, waterEvery의 배수를 새로 넘으면 true.
// - every: 몇 잔마다 (0 이하면 끔)
// - startAt: 이 잔수 이하에선 안 띄움(초반 빨리 마시는 구간 스킵, 0=처음부터)
export function crossesWaterMark(prev: number, next: number, every: number, startAt = 0): boolean {
  if (every <= 0) return false;
  if (next <= startAt) return false;
  return Math.floor(prev / every) < Math.floor(next / every);
}

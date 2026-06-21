import type { SessionRecord } from './storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 순알코올 1g ≈ 7.1 kcal
export function alcoholKcal(grams: number): number {
  return Math.round(grams * 7.1);
}

export type Hangover = { level: '낮음' | '보통' | '높음'; tip: string };

export function hangoverForecast(bac: number): Hangover {
  if (bac < 0.05) return { level: '낮음', tip: '물 한 잔이면 충분해요.' };
  if (bac < 0.1) return { level: '보통', tip: '자기 전 물 + 전해질, 충분한 수면.' };
  return { level: '높음', tip: '지금부터 물 자주, 안주 챙기고 일찍 마무리하세요.' };
}

// 한도(limit) 이내로 끝낸 술자리가 최근부터 몇 번 연속인지
export function limitStreak(history: SessionRecord[]): number {
  let n = 0;
  for (const r of history) {
    if (r.count <= r.limit) n += 1;
    else break;
  }
  return n;
}

// 최근 7일 술자리 횟수
export function sessionsThisWeek(history: SessionRecord[]): number {
  const since = Date.now() - WEEK_MS;
  return history.filter((r) => r.endedAt >= since).length;
}

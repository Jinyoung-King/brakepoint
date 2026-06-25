import type { DrinkType, DrinkUnit, Sex } from './storage';

// 술 종류 × 단위별 순알코올 근사량(g). 추정치(대략적 표준 제공량 기준).
const GRAMS: Record<DrinkType, Record<DrinkUnit, number>> = {
  소주: { 잔: 8, 병: 53, 캔: 53 }, // 소주 360ml 16.9% ≈ 48g, 잔 ≈ 8g
  맥주: { 잔: 10, 병: 20, 캔: 16 }, // 500ml 4.5% ≈ 18g
  와인: { 잔: 12, 병: 60, 캔: 12 }, // 750ml 12% ≈ 71g, 잔 150ml ≈ 14g
  양주: { 잔: 12, 병: 200, 캔: 12 }, // 위스키 45ml 40% ≈ 14g
};

const ELIMINATION_PER_HOUR = 0.015; // %/시간 (대사 속도)
export const DRIVE_LIMIT = 0.03; // 한국 면허정지 기준 %

export function alcoholGrams(count: number, unit: DrinkUnit, type: DrinkType): number {
  return count * (GRAMS[type]?.[unit] ?? 8);
}

// Widmark 추정. 반환: 혈중알코올농도 % (예: 0.05)
export function estimateBac(opts: {
  grams: number;
  weightKg: number;
  sex: Sex;
  hoursSinceStart: number;
}): number {
  const { grams, weightKg, sex, hoursSinceStart } = opts;
  if (grams <= 0 || weightKg <= 0) return 0;
  const r = sex === 'female' ? 0.55 : 0.68;
  const bodyG = weightKg * 1000;
  const raw = (grams / (bodyG * r)) * 100 - ELIMINATION_PER_HOUR * Math.max(0, hoursSinceStart);
  return Math.max(0, raw);
}

// 현재 BAC에서 target까지 내려가는 데 걸리는 시간(시간 단위)
export function hoursUntil(bacNow: number, target: number): number {
  if (bacNow <= target) return 0;
  return (bacNow - target) / ELIMINATION_PER_HOUR;
}

export type BacPoint = { t: number; bac: number }; // t = epoch ms

// estimateBac와 동일한 모델로 BAC 시간곡선을 샘플링한다.
// 각 음주 이벤트 시점에 그 양이 즉시 흡수된다고 보고(모델 단순화),
// 첫 잔 이후 시간당 ELIMINATION_PER_HOUR로 선형 분해. nowMs와 무관하게
// "첫 잔 → 완전 해독" 전체 구간을 그린다(예측 포함).
export function bacCurve(opts: {
  events: { t: number; grams: number }[];
  weightKg: number;
  sex: Sex;
  nowMs: number;
  samples?: number;
}): BacPoint[] {
  const { weightKg, sex, nowMs } = opts;
  const samples = Math.max(2, opts.samples ?? 48);
  const events = opts.events
    .filter((e) => e.grams > 0 && Number.isFinite(e.t))
    .sort((a, b) => a.t - b.t);
  if (events.length === 0 || weightKg <= 0) return [];

  const r = sex === 'female' ? 0.55 : 0.68;
  const bodyG = weightKg * 1000;
  const startMs = events[0].t;
  const totalGrams = events.reduce((sum, e) => sum + e.grams, 0);
  const peak = (totalGrams / (bodyG * r)) * 100; // 분해 무시한 최대 기여분(%)
  const soberMs = startMs + (peak / ELIMINATION_PER_HOUR) * 3600000;
  const endMs = Math.max(soberMs, nowMs); // 아직 음주 중이면 현재까지는 보장
  const span = Math.max(1, endMs - startMs);

  const bacAt = (t: number): number => {
    let cum = 0;
    for (const e of events) {
      if (e.t <= t) cum += e.grams;
      else break;
    }
    const raw = (cum / (bodyG * r)) * 100 - ELIMINATION_PER_HOUR * ((t - startMs) / 3600000);
    return Math.max(0, raw);
  };

  const points: BacPoint[] = [];
  for (let i = 0; i < samples; i++) {
    const t = startMs + (span * i) / (samples - 1);
    points.push({ t, bac: bacAt(t) });
  }
  return points;
}

export function fmtHours(h: number): string {
  if (h <= 0) return '0분';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}분`;
  return `${hh}시간 ${mm}분`;
}

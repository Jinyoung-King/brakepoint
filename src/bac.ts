import type { DrinkUnit, Sex } from './storage';

// 단위별 순알코올 근사량(g). 소주잔/맥주잔, 소주병, 맥주캔 기준 대략치.
const GRAMS_PER_UNIT: Record<DrinkUnit, number> = { 잔: 8, 병: 45, 캔: 16 };

const ELIMINATION_PER_HOUR = 0.015; // %/시간 (대사 속도)
export const DRIVE_LIMIT = 0.03; // 한국 면허정지 기준 %

export function alcoholGrams(count: number, unit: DrinkUnit): number {
  return count * (GRAMS_PER_UNIT[unit] ?? 8);
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

export function fmtHours(h: number): string {
  if (h <= 0) return '0분';
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm}분`;
  return `${hh}시간 ${mm}분`;
}

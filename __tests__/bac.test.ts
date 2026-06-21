import { alcoholGrams, estimateBac, hoursUntil, fmtHours, DRIVE_LIMIT } from '../src/bac';

describe('alcoholGrams', () => {
  it('scales by count and uses type/unit table', () => {
    expect(alcoholGrams(1, '잔', '소주')).toBe(8);
    expect(alcoholGrams(2, '잔', '소주')).toBe(16);
    expect(alcoholGrams(1, '병', '소주')).toBe(53);
    expect(alcoholGrams(1, '캔', '맥주')).toBe(16);
    expect(alcoholGrams(1, '잔', '와인')).toBe(12);
  });
  it('returns 0 for 0 count', () => {
    expect(alcoholGrams(0, '병', '양주')).toBe(0);
  });
});

describe('estimateBac', () => {
  it('is 0 with no alcohol', () => {
    expect(estimateBac({ grams: 0, weightKg: 70, sex: 'male', hoursSinceStart: 0 })).toBe(0);
  });
  it('rises with grams, never negative', () => {
    const a = estimateBac({ grams: 50, weightKg: 70, sex: 'male', hoursSinceStart: 0 });
    const b = estimateBac({ grams: 100, weightKg: 70, sex: 'male', hoursSinceStart: 0 });
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(0);
  });
  it('decreases over time and clamps at 0', () => {
    const now = estimateBac({ grams: 50, weightKg: 70, sex: 'male', hoursSinceStart: 0 });
    const later = estimateBac({ grams: 50, weightKg: 70, sex: 'male', hoursSinceStart: 2 });
    expect(later).toBeLessThan(now);
    expect(estimateBac({ grams: 50, weightKg: 70, sex: 'male', hoursSinceStart: 100 })).toBe(0);
  });
  it('female has higher BAC than male for same intake (lower r)', () => {
    const m = estimateBac({ grams: 40, weightKg: 60, sex: 'male', hoursSinceStart: 0 });
    const f = estimateBac({ grams: 40, weightKg: 60, sex: 'female', hoursSinceStart: 0 });
    expect(f).toBeGreaterThan(m);
  });
});

describe('hoursUntil', () => {
  it('is 0 when already at/under target', () => {
    expect(hoursUntil(0.02, DRIVE_LIMIT)).toBe(0);
    expect(hoursUntil(0, 0)).toBe(0);
  });
  it('computes positive time above target', () => {
    // 0.06% -> 0.03% at 0.015%/h = 2h
    expect(hoursUntil(0.06, 0.03)).toBeCloseTo(2, 5);
  });
});

describe('fmtHours', () => {
  it('formats durations', () => {
    expect(fmtHours(0)).toBe('0분');
    expect(fmtHours(0.5)).toBe('30분');
    expect(fmtHours(1.5)).toBe('1시간 30분');
    expect(fmtHours(2)).toBe('2시간 0분');
  });
});

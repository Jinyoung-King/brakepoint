import { alcoholGrams, estimateBac, hoursUntil, fmtHours, bacCurve, DRIVE_LIMIT } from '../src/bac';

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

describe('bacCurve', () => {
  const T = new Date(2026, 5, 24, 20, 0, 0).getTime();
  const HOUR = 3600_000;

  it('이벤트가 없으면 빈 배열', () => {
    expect(bacCurve({ events: [], weightKg: 70, sex: 'male', nowMs: T })).toEqual([]);
    expect(
      bacCurve({ events: [{ t: T, grams: 0 }], weightKg: 70, sex: 'male', nowMs: T })
    ).toEqual([]);
  });

  it('요청한 샘플 수만큼, 시간 오름차순으로 반환', () => {
    const pts = bacCurve({
      events: [{ t: T, grams: 40 }],
      weightKg: 70,
      sex: 'male',
      nowMs: T,
      samples: 24,
    });
    expect(pts).toHaveLength(24);
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThan(pts[i - 1].t);
  });

  it('첫 점은 첫 잔 직후 최고, 마지막 점은 완전 해독(0)', () => {
    const pts = bacCurve({ events: [{ t: T, grams: 40 }], weightKg: 70, sex: 'male', nowMs: T });
    expect(pts[0].bac).toBeGreaterThan(0);
    expect(pts[pts.length - 1].bac).toBeCloseTo(0, 5);
    // 단조 감소(잔 추가 없는 단일 이벤트)
    for (let i = 1; i < pts.length; i++) expect(pts[i].bac).toBeLessThanOrEqual(pts[i - 1].bac);
  });

  it('곡선의 한 시점이 estimateBac와 일치한다(동일 모델)', () => {
    const grams = 50;
    const pts = bacCurve({
      events: [{ t: T, grams }],
      weightKg: 70,
      sex: 'male',
      nowMs: T,
      samples: 100,
    });
    // 첫 잔 1시간 뒤에 가장 가까운 샘플을 estimateBac(1h)와 비교
    const target = T + HOUR;
    const closest = pts.reduce((a, b) =>
      Math.abs(b.t - target) < Math.abs(a.t - target) ? b : a
    );
    const expected = estimateBac({ grams, weightKg: 70, sex: 'male', hoursSinceStart: (closest.t - T) / HOUR });
    expect(closest.bac).toBeCloseTo(expected, 6);
  });

  it('나중 이벤트에서 BAC가 다시 올라간다(계단식 누적)', () => {
    const pts = bacCurve({
      events: [
        { t: T, grams: 20 },
        { t: T + 2 * HOUR, grams: 40 },
      ],
      weightKg: 70,
      sex: 'male',
      nowMs: T + 2 * HOUR,
      samples: 200,
    });
    // 두 번째 잔 직전 대비 직후 BAC가 더 높아야 한다
    const before = pts.filter((p) => p.t < T + 2 * HOUR).pop()!;
    const after = pts.find((p) => p.t >= T + 2 * HOUR)!;
    expect(after.bac).toBeGreaterThan(before.bac);
  });

  it('아직 음주 중(now가 해독 시점보다 앞)이면 적어도 now까지 그린다', () => {
    const pts = bacCurve({ events: [{ t: T, grams: 10 }], weightKg: 70, sex: 'male', nowMs: T + 10 * HOUR });
    expect(pts[pts.length - 1].t).toBeGreaterThanOrEqual(T + 10 * HOUR);
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

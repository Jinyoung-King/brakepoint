import { alcoholKcal, hangoverForecast, limitStreak, sessionsThisWeek } from '../src/stats';
import type { SessionRecord } from '../src/storage';

const rec = (count: number, limit: number, agoMs = 0): SessionRecord => ({
  id: String(Math.random()),
  endedAt: Date.now() - agoMs,
  count,
  limit,
});

describe('alcoholKcal', () => {
  it('is ~7.1 kcal per gram, rounded', () => {
    expect(alcoholKcal(0)).toBe(0);
    expect(alcoholKcal(10)).toBe(71);
    expect(alcoholKcal(53)).toBe(Math.round(53 * 7.1));
  });
});

describe('hangoverForecast', () => {
  it('tiers by BAC', () => {
    expect(hangoverForecast(0.02).level).toBe('낮음');
    expect(hangoverForecast(0.07).level).toBe('보통');
    expect(hangoverForecast(0.15).level).toBe('높음');
  });
});

describe('limitStreak', () => {
  it('counts consecutive within-limit sessions from most recent', () => {
    // history is most-recent-first
    expect(limitStreak([rec(3, 5), rec(5, 5), rec(2, 5)])).toBe(3);
    expect(limitStreak([rec(3, 5), rec(6, 5), rec(2, 5)])).toBe(1); // breaks at the over-limit one
    expect(limitStreak([rec(6, 5)])).toBe(0);
    expect(limitStreak([])).toBe(0);
  });
});

describe('sessionsThisWeek', () => {
  it('counts only sessions within the last 7 days', () => {
    const day = 24 * 60 * 60 * 1000;
    const h = [rec(2, 5, day), rec(2, 5, 3 * day), rec(2, 5, 10 * day)];
    expect(sessionsThisWeek(h)).toBe(2);
  });
});

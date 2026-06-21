import {
  alcoholKcal,
  hangoverForecast,
  limitStreak,
  sessionsThisWeek,
  dailyTotals,
  monthSpend,
  placeStats,
} from '../src/stats';
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

const at = (y: number, m: number, d: number, count: number, cost?: number, place?: string): SessionRecord => ({
  id: `${y}-${m}-${d}-${Math.random()}`,
  endedAt: new Date(y, m, d, 21, 0, 0).getTime(),
  count,
  limit: 5,
  cost,
  place,
});

describe('dailyTotals', () => {
  it('sums counts per day within a month', () => {
    const h = [at(2026, 5, 10, 3), at(2026, 5, 10, 2), at(2026, 5, 15, 4), at(2026, 4, 10, 9)];
    const t = dailyTotals(h, 2026, 5);
    expect(t[10]).toBe(5);
    expect(t[15]).toBe(4);
    expect(t[1]).toBeUndefined();
  });
});

describe('monthSpend', () => {
  it('sums cost within a month, ignoring others', () => {
    const h = [at(2026, 5, 1, 2, 30000), at(2026, 5, 9, 3, 20000), at(2026, 4, 1, 2, 99999)];
    expect(monthSpend(h, 2026, 5)).toBe(50000);
  });
});

describe('placeStats', () => {
  it('groups by place with session count and avg', () => {
    const h = [at(2026, 5, 1, 4, 0, 'A'), at(2026, 5, 2, 2, 0, 'A'), at(2026, 5, 3, 6, 0, 'B')];
    const s = placeStats(h);
    expect(s[0].place).toBe('A');
    expect(s[0].sessions).toBe(2);
    expect(s[0].avg).toBe(3);
  });
});

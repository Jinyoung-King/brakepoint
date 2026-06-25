import {
  alcoholKcal,
  hangoverForecast,
  limitStreak,
  sessionsThisWeek,
  dailyTotals,
  monthSpend,
  monthlyReport,
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

describe('monthlyReport', () => {
  it('세션 수·한계 준수율·술값을 집계한다', () => {
    const h = [
      at(2026, 5, 5, 3), // 준수 (3<=5)
      at(2026, 5, 12, 7), // 초과 (7>5)
      at(2026, 5, 20, 5, 20000), // 준수 + 비용
      at(2026, 4, 10, 2), // 지난달 → 제외
    ];
    const r = monthlyReport(h, 2026, 5);
    expect(r.sessions).toBe(3);
    expect(r.withinLimit).toBe(2);
    expect(r.withinRate).toBeCloseTo(2 / 3, 5);
    expect(r.spend).toBe(20000);
  });

  it('지난달 대비 증감 %를 계산한다', () => {
    const h = [
      at(2026, 5, 1, 2), at(2026, 5, 2, 2), at(2026, 5, 3, 2), // 이달 3회
      at(2026, 4, 1, 2), at(2026, 4, 2, 2), // 지난달 2회
    ];
    const r = monthlyReport(h, 2026, 5);
    expect(r.prevSessions).toBe(2);
    expect(r.deltaPct).toBe(50); // (3-2)/2
  });

  it('지난달 기록이 없으면 deltaPct는 null', () => {
    expect(monthlyReport([at(2026, 5, 1, 2)], 2026, 5).deltaPct).toBeNull();
  });

  it('요일별 잔수를 합산하고 최다 요일을 고른다', () => {
    const r = monthlyReport([at(2026, 5, 5, 2), at(2026, 5, 5, 3), at(2026, 5, 6, 1)], 2026, 5);
    const wd5 = new Date(2026, 5, 5).getDay();
    const wd6 = new Date(2026, 5, 6).getDay();
    expect(r.weekdayCounts[wd5]).toBe(5);
    expect(r.weekdayCounts[wd6]).toBe(1);
    expect(r.topWeekday).toBe(wd5);
  });

  it('기록 없는 달은 0·null로 안전하게 반환', () => {
    const r = monthlyReport([], 2026, 5);
    expect(r.sessions).toBe(0);
    expect(r.withinRate).toBe(0);
    expect(r.topWeekday).toBeNull();
    expect(r.deltaPct).toBeNull();
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

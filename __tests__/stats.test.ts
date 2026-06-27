import {
  alcoholKcal,
  hangoverForecast,
  limitStreak,
  sessionsThisWeek,
  dailyTotals,
  monthSpend,
  monthlyReport,
  lastWeekReport,
  nextWeeklyReportAt,
  formatWeekReport,
  hourlyTotals,
  peakHour,
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

describe('nextWeeklyReportAt', () => {
  const DAY = 24 * 3600 * 1000;
  it('항상 월요일 09:00이고 now 이후다', () => {
    const wed = new Date(2026, 5, 24, 15, 0, 0).getTime();
    const at0 = new Date(nextWeeklyReportAt(wed));
    expect(at0.getDay()).toBe(1); // 월요일
    expect(at0.getHours()).toBe(9);
    expect(at0.getMinutes()).toBe(0);
    expect(at0.getTime()).toBeGreaterThan(wed);
  });
  it('월요일 9시 경계: 이전이면 당일, 이후면 다음 주', () => {
    const mon9 = nextWeeklyReportAt(new Date(2026, 5, 24, 15, 0, 0).getTime()); // 어떤 월요일 09:00
    const before = new Date(mon9);
    before.setHours(8, 0, 0, 0);
    expect(nextWeeklyReportAt(before.getTime())).toBe(mon9);
    const after = new Date(mon9);
    after.setHours(10, 0, 0, 0);
    expect(nextWeeklyReportAt(after.getTime())).toBe(mon9 + 7 * DAY);
  });
});

describe('lastWeekReport', () => {
  const DAY = 24 * 3600 * 1000;
  const mk = (endedAt: number, count: number, limit = 5, cost?: number): SessionRecord => ({
    id: String(endedAt),
    endedAt,
    count,
    limit,
    cost,
  });
  it('ref 직전 주(월~일) 기록만 집계한다', () => {
    const ref = new Date(2026, 5, 24, 12, 0, 0).getTime();
    // 구현과 동일하게 이번 주 월요일 00:00 계산
    const m = new Date(ref);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
    const monday = m.getTime();

    const r = lastWeekReport(
      [
        mk(monday - 3 * DAY, 3, 5), // 지난주, 준수
        mk(monday - 2 * DAY, 7, 5, 20000), // 지난주, 초과 + 비용
        mk(monday + 1 * DAY, 2, 5), // 이번 주 → 제외
        mk(monday - 10 * DAY, 5, 5), // 2주 전 → 제외
      ],
      ref
    );
    expect(r.sessions).toBe(2);
    expect(r.withinLimit).toBe(1);
    expect(r.withinRate).toBeCloseTo(0.5, 5);
    expect(r.spend).toBe(20000);
  });
});

describe('formatWeekReport', () => {
  it('기록 없으면 격려 문구', () => {
    expect(formatWeekReport({ sessions: 0, withinLimit: 0, withinRate: 0, spend: 0 })).toContain(
      '기록이 없었어요'
    );
  });
  it('횟수·준수·술값을 담는다', () => {
    const s = formatWeekReport({ sessions: 3, withinLimit: 2, withinRate: 2 / 3, spend: 50000 });
    expect(s).toContain('3회');
    expect(s).toContain('2/3');
    expect(s).toContain('50,000원');
  });
});

describe('hourlyTotals / peakHour', () => {
  const atHour = (h: number, count: number, events?: { t: number; n: number }[]): SessionRecord => ({
    id: `${h}-${Math.random()}`,
    endedAt: new Date(2026, 5, 1, h, 0, 0).getTime(),
    count,
    limit: 5,
    events,
  });

  it('events가 있으면 잔별 시각으로 합산', () => {
    const ev = [
      { t: new Date(2026, 5, 1, 20, 10).getTime(), n: 2 },
      { t: new Date(2026, 5, 1, 22, 30).getTime(), n: 1 },
    ];
    const h = hourlyTotals([atHour(22, 3, ev)]);
    expect(h[20]).toBe(2);
    expect(h[22]).toBe(1);
    expect(h[21]).toBe(0);
  });

  it('events가 없으면 종료 시각에 합산', () => {
    const h = hourlyTotals([atHour(19, 4)]);
    expect(h[19]).toBe(4);
  });

  it('peakHour는 최다 시간대 index, 비면 null', () => {
    const h = hourlyTotals([atHour(19, 2), atHour(21, 5), atHour(21, 1)]);
    expect(peakHour(h)).toBe(21);
    expect(peakHour(Array(24).fill(0))).toBeNull();
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

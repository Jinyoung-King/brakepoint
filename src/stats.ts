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

const sameYM = (ms: number, year: number, month: number) => {
  const d = new Date(ms);
  return d.getFullYear() === year && d.getMonth() === month;
};

// 해당 월(year, month=0-based)의 날짜별 음주량 합계 { day: totalCount }
export function dailyTotals(history: SessionRecord[], year: number, month: number): Record<number, number> {
  const out: Record<number, number> = {};
  for (const r of history) {
    if (sameYM(r.endedAt, year, month)) {
      const day = new Date(r.endedAt).getDate();
      out[day] = (out[day] ?? 0) + r.count;
    }
  }
  return out;
}

// 해당 월 술값 합계(원)
export function monthSpend(history: SessionRecord[], year: number, month: number): number {
  return history
    .filter((r) => sameYM(r.endedAt, year, month))
    .reduce((a, r) => a + (r.cost ?? 0), 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 기준 시각이 속한 주의 월요일 00:00 (월요일 시작 주)
function startOfWeekMon(ref: number): number {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() + 6) % 7; // 월요일로부터 지난 일수 (월=0)
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

export type WeekReport = {
  sessions: number;
  withinLimit: number;
  withinRate: number; // 0..1
  spend: number;
};

// ref 시점 직전에 끝난 한 주(월~일) 요약. 알림은 fireTime 기준으로 호출한다.
export function lastWeekReport(history: SessionRecord[], ref: number): WeekReport {
  const end = startOfWeekMon(ref); // 이번 주 월요일 = 지난주의 끝(배타)
  const start = end - 7 * DAY_MS;
  const recs = history.filter((r) => r.endedAt >= start && r.endedAt < end);
  const sessions = recs.length;
  const withinLimit = recs.filter((r) => r.count <= r.limit).length;
  const withinRate = sessions > 0 ? withinLimit / sessions : 0;
  const spend = recs.reduce((a, r) => a + (r.cost ?? 0), 0);
  return { sessions, withinLimit, withinRate, spend };
}

// now 이후 가장 가까운 월요일 09:00 (epoch ms)
export function nextWeeklyReportAt(now: number): number {
  const d = new Date(now);
  d.setHours(9, 0, 0, 0);
  let add = (8 - d.getDay()) % 7; // 다음 월요일까지 일수 (월=0)
  if (add === 0 && d.getTime() <= now) add = 7; // 오늘이 월요일인데 9시 지났으면 다음 주
  d.setDate(d.getDate() + add);
  return d.getTime();
}

// 알림 본문 텍스트
export function formatWeekReport(r: WeekReport): string {
  if (r.sessions === 0) return '지난주엔 술자리 기록이 없었어요. 좋아요 👏';
  const won = r.spend > 0 ? ` · 술값 ${r.spend.toLocaleString('ko-KR')}원` : '';
  return `지난주 술자리 ${r.sessions}회 · 한도 준수 ${r.withinLimit}/${r.sessions}${won}`;
}

export type MonthlyReport = {
  sessions: number; // 이 달 술자리 횟수
  prevSessions: number; // 지난달 횟수
  deltaPct: number | null; // 지난달 대비 증감 %, 지난달 0이면 null
  withinLimit: number; // 한계 이내로 끝낸 횟수
  withinRate: number; // 0..1 (sessions=0이면 0)
  weekdayCounts: number[]; // 요일별 총 잔수 (0=일 ~ 6=토)
  topWeekday: number | null; // 가장 많이 마신 요일 index, 데이터 없으면 null
  spend: number; // 이 달 술값 합계(원)
};

// 해당 월(year, month=0-based)의 음주 패턴 집계
export function monthlyReport(history: SessionRecord[], year: number, month: number): MonthlyReport {
  const recs = history.filter((r) => sameYM(r.endedAt, year, month));
  const prev = new Date(year, month - 1, 1);
  const prevSessions = history.filter((r) =>
    sameYM(r.endedAt, prev.getFullYear(), prev.getMonth())
  ).length;
  const sessions = recs.length;
  const deltaPct =
    prevSessions > 0 ? Math.round(((sessions - prevSessions) / prevSessions) * 100) : null;
  const withinLimit = recs.filter((r) => r.count <= r.limit).length;
  const withinRate = sessions > 0 ? withinLimit / sessions : 0;

  const weekdayCounts = Array(7).fill(0) as number[];
  for (const r of recs) weekdayCounts[new Date(r.endedAt).getDay()] += r.count;
  let topWeekday: number | null = null;
  let max = 0;
  weekdayCounts.forEach((v, i) => {
    if (v > max) {
      max = v;
      topWeekday = i;
    }
  });

  const spend = recs.reduce((a, r) => a + (r.cost ?? 0), 0);
  return { sessions, prevSessions, deltaPct, withinLimit, withinRate, weekdayCounts, topWeekday, spend };
}

// 장소별 통계 (세션 수 desc), 상위 limit개
export function placeStats(
  history: SessionRecord[],
  topN = 5
): { place: string; sessions: number; avg: number }[] {
  const m = new Map<string, { sessions: number; total: number }>();
  for (const r of history) {
    const p = r.place?.trim();
    if (!p) continue;
    const e = m.get(p) ?? { sessions: 0, total: 0 };
    e.sessions += 1;
    e.total += r.count;
    m.set(p, e);
  }
  return Array.from(m.entries())
    .map(([place, e]) => ({ place, sessions: e.sessions, avg: e.total / e.sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, topN);
}

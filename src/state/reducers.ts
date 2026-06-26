// AppState 전이(transition) 순수 함수. Provider는 이걸 호출만 한다.
// `now`(epoch ms)를 인자로 받아 테스트가 결정적이도록 한다.
import type { AppState, SessionRecord } from '../storage';

export type EndSessionExtra = { place?: string; memo?: string; cost?: number };

export type ManualRecordInput = {
  count: number;
  limit: number;
  daysAgo: number;
  time?: string;
  place?: string;
  memo?: string;
  cost?: number;
};

function sameDay(a: number, b: number): boolean {
  const x = new Date(a);
  const y = new Date(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

// 그날(기준 시각과 같은 날)의 기존 기록 수 + 1 = 차수(N차)
function roundForDay(history: SessionRecord[], dayMs: number): number {
  return history.filter((r) => sameDay(r.endedAt, dayMs)).length + 1;
}

export function addDrink(s: AppState, n: number, now: number): AppState {
  return {
    ...s,
    count: s.count + n,
    lastDrinkMs: now,
    sessionStartMs: s.sessionStartMs ?? now,
    drinkEvents: [...s.drinkEvents, { t: now, n }],
  };
}

export function undoDrink(s: AppState): AppState {
  if (s.count <= 0 || s.drinkEvents.length === 0) return s;
  const events = s.drinkEvents.slice(0, -1);
  const last = s.drinkEvents[s.drinkEvents.length - 1];
  const count = Math.max(0, s.count - last.n);
  return {
    ...s,
    count,
    drinkEvents: events,
    lastDrinkMs: events.length ? events[events.length - 1].t : null,
    sessionStartMs: count > 0 ? s.sessionStartMs : null,
  };
}

export function addCig(s: AppState): AppState {
  return { ...s, cigs: s.cigs + 1 };
}

export function endSession(s: AppState, extra: EndSessionExtra | undefined, now: number): AppState {
  if (s.count <= 0 && s.cigs <= 0) return s;
  const rec: SessionRecord = {
    id: String(now),
    endedAt: now,
    count: s.count,
    limit: s.limit,
    unit: s.unit,
    cigs: s.cigs,
    place: extra?.place?.trim() || undefined,
    memo: extra?.memo?.trim() || undefined,
    round: roundForDay(s.history, now),
    events: s.drinkEvents,
    cost: extra?.cost && extra.cost > 0 ? extra.cost : undefined,
  };
  return {
    ...s,
    count: 0,
    cigs: 0,
    sessionStartMs: null,
    lastDrinkMs: null,
    drinkEvents: [],
    history: [rec, ...s.history],
  };
}

// 기록 1건 삭제 (id 일치). 없으면 그대로.
export function deleteRecord(s: AppState, id: string): AppState {
  if (!s.history.some((r) => r.id === id)) return s;
  return { ...s, history: s.history.filter((r) => r.id !== id) };
}

export function addManualRecord(s: AppState, r: ManualRecordInput, now: number): AppState {
  const d = new Date(now);
  d.setDate(d.getDate() - Math.max(0, Math.floor(r.daysAgo)));
  const [hh, mm] = (r.time || '').split(':').map((x) => parseInt(x, 10));
  d.setHours(Number.isFinite(hh) ? hh : 21, Number.isFinite(mm) ? mm : 0, 0, 0);
  const endedAt = d.getTime();
  const rec: SessionRecord = {
    id: `m-${endedAt}-${s.history.length}`,
    endedAt,
    count: r.count,
    limit: r.limit,
    unit: s.unit,
    place: r.place?.trim() || undefined,
    memo: r.memo?.trim() || undefined,
    round: roundForDay(s.history, endedAt),
    events: [],
    cost: r.cost && r.cost > 0 ? r.cost : undefined,
  };
  return { ...s, history: [rec, ...s.history].sort((a, b) => b.endedAt - a.endedAt) };
}

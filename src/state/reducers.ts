// AppState 전이(transition) 순수 함수. Provider는 이걸 호출만 한다.
// `now`(epoch ms)를 인자로 받아 테스트가 결정적이도록 한다.
import type { AppState, DrinkType, DrinkUnit, SessionRecord } from '../storage';

export type EndSessionExtra = { place?: string; memo?: string; cost?: number };

export type ManualRecordInput = {
  count: number;
  limit: number;
  daysAgo?: number; // at이 없을 때만 사용(며칠 전). 기본 0.
  time?: string;
  at?: number; // 절대 종료 시각(epoch ms). 주어지면 daysAgo/time 대신 이걸 그대로 쓴다(날짜/시간 피커용).
  unit?: DrinkUnit; // 단위(잔/병/캔). 없으면 세션 기본값.
  place?: string;
  memo?: string;
  cost?: number;
  type?: DrinkType; // 주종 (통계 주종별 집계용)
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
    drinkEvents: [...s.drinkEvents, { t: now, n, type: s.drinkType, unit: s.unit }],
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

export function addWater(s: AppState): AppState {
  return { ...s, water: s.water + 1 };
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
    water: s.water || undefined,
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
    water: 0,
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

export type RecordPatch = {
  count: number;
  limit: number;
  place?: string;
  memo?: string;
  cost?: number;
  type?: DrinkType;
  unit?: DrinkUnit;
  at?: number; // 종료 시각(epoch ms) 변경. 주어지면 날짜/시각을 옮기고 차수·정렬을 다시 맞춘다.
};

// 기록 1건 수정. at을 주면 날짜/시각까지 바꾼다(차수 재계산·이벤트 시각 이동·재정렬).
// 주종/단위가 바뀌면 타임라인을 단일 이벤트로 재구성(통계·취기 환산에 반영).
export function updateRecord(s: AppState, id: string, patch: RecordPatch): AppState {
  const target = s.history.find((r) => r.id === id);
  if (!target) return s;
  const newEndedAt = patch.at ?? target.endedAt;
  const moved = newEndedAt !== target.endedAt;
  const delta = newEndedAt - target.endedAt;
  const nextUnit = patch.unit ?? target.unit;
  // 날짜가 바뀌면 새 날 기준 차수(자기 제외 같은 날 기록 수 + 1) 재계산.
  const round = moved
    ? s.history.filter((r) => r.id !== id && sameDay(r.endedAt, newEndedAt)).length + 1
    : target.round;
  const mapped = s.history.map((r) => {
    if (r.id !== id) return r;
    return {
      ...r,
      endedAt: newEndedAt,
      round,
      count: patch.count,
      limit: patch.limit,
      unit: nextUnit,
      place: patch.place?.trim() || undefined,
      memo: patch.memo?.trim() || undefined,
      cost: patch.cost && patch.cost > 0 ? patch.cost : undefined,
      events:
        patch.type || patch.unit
          ? [{ t: newEndedAt, n: patch.count, type: patch.type ?? r.events?.[0]?.type, unit: nextUnit }]
          : moved
            ? (r.events ?? []).map((e) => ({ ...e, t: e.t + delta })) // 세션 내부 간격 유지하며 통째로 이동
            : r.events,
    };
  });
  return { ...s, history: moved ? mapped.sort((a, b) => b.endedAt - a.endedAt) : mapped };
}

export function addManualRecord(s: AppState, r: ManualRecordInput, now: number): AppState {
  let endedAt: number;
  if (r.at != null && Number.isFinite(r.at)) {
    // 날짜/시간 피커가 준 절대 시각을 그대로 사용.
    endedAt = r.at;
  } else {
    const d = new Date(now);
    d.setDate(d.getDate() - Math.max(0, Math.floor(r.daysAgo ?? 0)));
    // 범위를 벗어난 시/분("25:70" 등)은 기본값으로 폴백. 그대로 setHours에 넣으면
    // Date가 다음날로 롤오버돼 endedAt(날짜)이 조용히 바뀌는 걸 막는다.
    const [hh, mm] = (r.time || '').split(':').map((x) => parseInt(x, 10));
    const validH = Number.isFinite(hh) && hh >= 0 && hh <= 23;
    const validM = Number.isFinite(mm) && mm >= 0 && mm <= 59;
    d.setHours(validH ? hh : 21, validM ? mm : 0, 0, 0);
    endedAt = d.getTime();
  }
  const recUnit = r.unit ?? s.unit;
  const rec: SessionRecord = {
    id: `m-${endedAt}-${s.history.length}`,
    endedAt,
    count: r.count,
    limit: r.limit,
    unit: recUnit,
    place: r.place?.trim() || undefined,
    memo: r.memo?.trim() || undefined,
    round: roundForDay(s.history, endedAt),
    // 주종이 있으면 단일 이벤트로 기록 → 주종/단위별 통계·취기 환산에 잡힘.
    events: r.type ? [{ t: endedAt, n: r.count, type: r.type, unit: recUnit }] : [],
    cost: r.cost && r.cost > 0 ? r.cost : undefined,
  };
  return { ...s, history: [rec, ...s.history].sort((a, b) => b.endedAt - a.endedAt) };
}

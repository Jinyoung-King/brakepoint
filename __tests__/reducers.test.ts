import {
  addDrink,
  undoDrink,
  addCig,
  endSession,
  addManualRecord,
  deleteRecord,
} from '../src/state/reducers';
import { DEFAULT_STATE, type AppState, type SessionRecord } from '../src/storage';

const base = (over: Partial<AppState> = {}): AppState => ({ ...DEFAULT_STATE, ...over });

// 2026-06-24 21:00 KST 근처 임의 고정 시각
const T = new Date(2026, 5, 24, 21, 0, 0).getTime();
const HOUR = 3600_000;
const DAY = 24 * HOUR;

describe('addDrink', () => {
  it('첫 잔이면 sessionStartMs를 현재로 잡고 event를 쌓는다', () => {
    const s = addDrink(base({ count: 0, sessionStartMs: null, lastDrinkMs: null, drinkEvents: [] }), 1, T);
    expect(s.count).toBe(1);
    expect(s.sessionStartMs).toBe(T);
    expect(s.lastDrinkMs).toBe(T);
    expect(s.drinkEvents).toEqual([{ t: T, n: 1 }]);
  });

  it('이미 진행 중이면 sessionStartMs는 유지하고 lastDrinkMs만 갱신', () => {
    const start = T - HOUR;
    const s = addDrink(
      base({ count: 2, sessionStartMs: start, lastDrinkMs: start, drinkEvents: [{ t: start, n: 2 }] }),
      3,
      T
    );
    expect(s.count).toBe(5);
    expect(s.sessionStartMs).toBe(start); // 유지
    expect(s.lastDrinkMs).toBe(T);
    expect(s.drinkEvents).toEqual([{ t: start, n: 2 }, { t: T, n: 3 }]);
  });
});

describe('undoDrink', () => {
  it('직전 이벤트를 되돌리고 그 양만큼 count 감소', () => {
    const s = addDrink(addDrink(base(), 1, T - HOUR), 2, T); // count 3, events 2개
    const u = undoDrink(s);
    expect(u.count).toBe(1);
    expect(u.drinkEvents).toEqual([{ t: T - HOUR, n: 1 }]);
    expect(u.lastDrinkMs).toBe(T - HOUR); // 이전 이벤트 시각으로 복귀
    expect(u.sessionStartMs).toBe(T - HOUR); // 아직 잔이 남아있으니 세션 유지
  });

  it('마지막 한 잔을 되돌리면 세션이 닫힌다(sessionStart/last=null)', () => {
    const s = addDrink(base(), 1, T);
    const u = undoDrink(s);
    expect(u.count).toBe(0);
    expect(u.drinkEvents).toEqual([]);
    expect(u.lastDrinkMs).toBeNull();
    expect(u.sessionStartMs).toBeNull();
  });

  it('count가 0이거나 이벤트가 없으면 그대로 반환(no-op)', () => {
    const empty = base({ count: 0, drinkEvents: [] });
    expect(undoDrink(empty)).toBe(empty);
  });

  it('count가 event 합보다 클 때도 음수로 안 내려간다', () => {
    const s = base({ count: 1, drinkEvents: [{ t: T, n: 5 }] });
    expect(undoDrink(s).count).toBe(0); // Math.max(0, 1-5)
  });
});

describe('addCig', () => {
  it('흡연 개비 +1', () => {
    expect(addCig(base({ cigs: 2 })).cigs).toBe(3);
  });
});

describe('endSession', () => {
  it('마신 게 없고 흡연도 없으면 no-op', () => {
    const s = base({ count: 0, cigs: 0 });
    expect(endSession(s, undefined, T)).toBe(s);
  });

  it('흡연만 있어도 기록을 남긴다', () => {
    const s = base({ count: 0, cigs: 3 });
    const r = endSession(s, undefined, T);
    expect(r.history).toHaveLength(1);
    expect(r.history[0].cigs).toBe(3);
  });

  it('세션 상태를 초기화하고 history 맨 앞에 기록을 넣는다', () => {
    const s = base({
      count: 4,
      cigs: 2,
      limit: 5,
      sessionStartMs: T - HOUR,
      lastDrinkMs: T,
      drinkEvents: [{ t: T, n: 4 }],
    });
    const r = endSession(s, { place: '  강남  ', memo: ' 좋았음 ', cost: 30000 }, T);
    expect(r.count).toBe(0);
    expect(r.cigs).toBe(0);
    expect(r.sessionStartMs).toBeNull();
    expect(r.lastDrinkMs).toBeNull();
    expect(r.drinkEvents).toEqual([]);
    const rec = r.history[0];
    expect(rec.count).toBe(4);
    expect(rec.place).toBe('강남'); // trim
    expect(rec.memo).toBe('좋았음');
    expect(rec.cost).toBe(30000);
    expect(rec.events).toEqual([{ t: T, n: 4 }]);
  });

  it('빈 문자열/0 비용은 undefined로 정규화', () => {
    const s = base({ count: 1 });
    const rec = endSession(s, { place: '   ', cost: 0 }, T).history[0];
    expect(rec.place).toBeUndefined();
    expect(rec.cost).toBeUndefined();
  });

  it('같은 날 종료한 세션마다 차수(round)가 1씩 증가', () => {
    const prior: SessionRecord = { id: 'a', endedAt: T - 2 * HOUR, count: 2, limit: 5 };
    const r = endSession(base({ count: 1, history: [prior] }), undefined, T);
    expect(r.history[0].round).toBe(2); // 같은 날 2차
  });

  it('다른 날 기록은 차수에 안 들어간다', () => {
    const yesterday: SessionRecord = { id: 'y', endedAt: T - DAY, count: 2, limit: 5 };
    const r = endSession(base({ count: 1, history: [yesterday] }), undefined, T);
    expect(r.history[0].round).toBe(1); // 오늘은 1차
  });
});

describe('deleteRecord', () => {
  const h: SessionRecord[] = [
    { id: 'a', endedAt: T, count: 3, limit: 5 },
    { id: 'b', endedAt: T - DAY, count: 2, limit: 5 },
  ];

  it('id가 일치하는 기록만 지운다', () => {
    const r = deleteRecord(base({ history: h }), 'a');
    expect(r.history).toHaveLength(1);
    expect(r.history[0].id).toBe('b');
  });

  it('없는 id면 그대로 반환(no-op)', () => {
    const s = base({ history: h });
    expect(deleteRecord(s, 'zzz')).toBe(s);
  });
});

describe('addManualRecord', () => {
  it('daysAgo/time을 반영해 endedAt을 만든다', () => {
    const r = addManualRecord(base(), { count: 3, limit: 5, daysAgo: 2, time: '19:30' }, T);
    const d = new Date(r.history[0].endedAt);
    const expected = new Date(2026, 5, 22, 19, 30, 0, 0);
    expect(d.getTime()).toBe(expected.getTime());
  });

  it('time이 없으면 21:00 기본값', () => {
    const r = addManualRecord(base(), { count: 1, limit: 5, daysAgo: 0 }, T);
    expect(new Date(r.history[0].endedAt).getHours()).toBe(21);
  });

  it('history를 endedAt 내림차순으로 정렬해 끼워넣는다', () => {
    const existing: SessionRecord = { id: 'now', endedAt: T, count: 1, limit: 5 };
    // 어제 기록을 수동 추가하면 오늘 기록 뒤로 정렬돼야 한다
    const r = addManualRecord(base({ history: [existing] }), { count: 2, limit: 5, daysAgo: 1 }, T);
    expect(r.history[0].id).toBe('now'); // 최신이 앞
    expect(r.history[1].count).toBe(2);
    expect(r.history[0].endedAt).toBeGreaterThan(r.history[1].endedAt);
  });

  it('같은 날 기존 기록 수에 따라 차수가 매겨진다', () => {
    const sameDayRec: SessionRecord = { id: 's', endedAt: new Date(2026, 5, 23, 12, 0, 0).getTime(), count: 1, limit: 5 };
    const r = addManualRecord(base({ history: [sameDayRec] }), { count: 2, limit: 5, daysAgo: 1, time: '20:00' }, T);
    const added = r.history.find((x) => x.count === 2)!;
    expect(added.round).toBe(2);
  });
});

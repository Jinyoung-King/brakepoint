import { migrateAppState, DEFAULT_STATE, SCHEMA_VERSION } from '../src/storage';

describe('migrateAppState (저장 스키마 마이그레이션·방어)', () => {
  it('버전 없는 구버전 데이터도 현재 버전으로 채운다', () => {
    const r = migrateAppState({ limit: 9, count: 3 });
    expect(r.schemaVersion).toBe(SCHEMA_VERSION);
    expect(r.limit).toBe(9); // 기존 값 유지
    expect(r.count).toBe(3);
    expect(r.unit).toBe(DEFAULT_STATE.unit); // 누락 필드는 기본값
    expect(r.customDrinks).toEqual([]);
  });

  it('null/비객체 입력도 안전하게 기본값 반환', () => {
    expect(migrateAppState(null)).toEqual({ ...DEFAULT_STATE, schemaVersion: SCHEMA_VERSION });
    expect(migrateAppState('garbage').limit).toBe(DEFAULT_STATE.limit);
  });

  it('배열 필드가 깨져 있으면 빈 배열로 방어', () => {
    const r = migrateAppState({ history: 'oops', drinkEvents: null, customDrinks: 42 });
    expect(r.history).toEqual([]);
    expect(r.drinkEvents).toEqual([]);
    expect(r.customDrinks).toEqual([]);
  });

  it('fakeCall 부분 손상 시 기본값 위에 병합', () => {
    const r = migrateAppState({ fakeCall: { callerName: '아빠' } });
    expect(r.fakeCall.callerName).toBe('아빠');
    expect(r.fakeCall.periodMin).toBe(DEFAULT_STATE.fakeCall.periodMin); // 누락분 기본값
    const bad = migrateAppState({ fakeCall: 'nope' });
    expect(bad.fakeCall).toEqual(DEFAULT_STATE.fakeCall);
  });

  it('유효한 커스텀 주종·기록은 보존', () => {
    const customDrinks = [{ id: 'c1', name: '하이볼', abv: 7, ml: 350, grams: 19.3 }];
    const r = migrateAppState({ customDrinks });
    expect(r.customDrinks).toEqual(customDrinks);
  });
});

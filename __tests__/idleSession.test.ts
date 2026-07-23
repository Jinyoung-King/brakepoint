import { idleBaseline, idleDueAt, isIdleDue } from '../src/idleSession';
import { DEFAULT_STATE, type AppState } from '../src/storage';
import { endSession } from '../src/state/reducers';

const T = new Date(2026, 6, 23, 21, 0, 0).getTime();
const MIN = 60000;
const s = (over: Partial<AppState> = {}): AppState => ({
  ...DEFAULT_STATE,
  drinkingMode: true,
  count: 3,
  idleEndMin: 120,
  sessionStartMs: T - 60 * MIN,
  lastDrinkMs: T - 30 * MIN,
  idleSnoozeMs: 0,
  ...over,
});

describe('idleBaseline', () => {
  it('마지막 잔·스누즈 중 더 최근을 쓴다', () => {
    expect(idleBaseline({ lastDrinkMs: T, sessionStartMs: T - MIN, idleSnoozeMs: 0 })).toBe(T);
    expect(idleBaseline({ lastDrinkMs: T - 10 * MIN, sessionStartMs: null, idleSnoozeMs: T })).toBe(T);
  });
  it('마지막 잔 없으면 첫 잔(sessionStart)으로 폴백', () => {
    expect(idleBaseline({ lastDrinkMs: null, sessionStartMs: T, idleSnoozeMs: 0 })).toBe(T);
  });
});

describe('idleDueAt', () => {
  it('음주모드 꺼짐/잔 0/설정 0이면 null', () => {
    expect(idleDueAt(s({ drinkingMode: false }))).toBeNull();
    expect(idleDueAt(s({ count: 0 }))).toBeNull();
    expect(idleDueAt(s({ idleEndMin: 0 }))).toBeNull();
  });
  it('기준 시각 + idleEndMin', () => {
    expect(idleDueAt(s({ lastDrinkMs: T, idleEndMin: 120 }))).toBe(T + 120 * MIN);
  });
  it('스누즈가 마지막 잔보다 최근이면 스누즈 기준', () => {
    expect(idleDueAt(s({ lastDrinkMs: T - 30 * MIN, idleSnoozeMs: T, idleEndMin: 90 }))).toBe(T + 90 * MIN);
  });
  it('기준 시각이 없으면 null', () => {
    expect(idleDueAt(s({ lastDrinkMs: null, sessionStartMs: null, idleSnoozeMs: 0 }))).toBeNull();
  });
});

describe('isIdleDue', () => {
  it('마지막 잔 30분 전 + 임계 120분이면 아직 아님', () => {
    expect(isIdleDue(s({ lastDrinkMs: T - 30 * MIN, idleEndMin: 120 }), T)).toBe(false);
  });
  it('마지막 잔 130분 전 + 임계 120분이면 방치', () => {
    expect(isIdleDue(s({ lastDrinkMs: T - 130 * MIN, idleEndMin: 120 }), T)).toBe(true);
  });
  it('경계(정확히 임계)면 방치로 본다', () => {
    expect(isIdleDue(s({ lastDrinkMs: T - 120 * MIN, idleEndMin: 120 }), T)).toBe(true);
  });
});

describe('endSession은 방치 상태를 리셋한다', () => {
  it('idleSnoozeMs·pendingIdlePrompt를 초기화', () => {
    const st = s({ idleSnoozeMs: T, pendingIdlePrompt: true, drinkEvents: [{ t: T, n: 3 }] });
    const next = endSession(st, undefined, T);
    expect(next.idleSnoozeMs).toBe(0);
    expect(next.pendingIdlePrompt).toBe(false);
  });
});

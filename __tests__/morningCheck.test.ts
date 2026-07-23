import { nextMorningAt } from '../src/morningCheck';
import { setMorningLog } from '../src/state/reducers';
import { morningInsight } from '../src/stats';
import { DEFAULT_STATE, type AppState, type SessionRecord, type MorningLog } from '../src/storage';

const base = (over: Partial<AppState> = {}): AppState => ({ ...DEFAULT_STATE, ...over });
const rec = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: over.id ?? 'r1',
  endedAt: over.endedAt ?? 0,
  count: over.count ?? 5,
  limit: over.limit ?? 5,
  ...over,
});

describe('nextMorningAt', () => {
  it('밤 11시 종료 → 다음날 아침 9시', () => {
    const night = new Date(2026, 6, 23, 23, 0, 0).getTime();
    const at = new Date(nextMorningAt(night, 9));
    expect(at.getDate()).toBe(24);
    expect(at.getHours()).toBe(9);
    expect(at.getMinutes()).toBe(0);
  });

  it('새벽 2시 종료 → 같은 날 아침 9시(7시간 뒤)', () => {
    const dawn = new Date(2026, 6, 24, 2, 0, 0).getTime();
    const at = new Date(nextMorningAt(dawn, 9));
    expect(at.getDate()).toBe(24);
    expect(at.getHours()).toBe(9);
  });

  it('정확히 그 시각이면 다음날로 넘긴다(과거·현재 제외)', () => {
    const nine = new Date(2026, 6, 24, 9, 0, 0).getTime();
    const at = new Date(nextMorningAt(nine, 9));
    expect(at.getDate()).toBe(25);
  });

  it('시각을 0~23으로 클램프', () => {
    const t = new Date(2026, 6, 24, 12, 0, 0).getTime();
    expect(new Date(nextMorningAt(t, 30)).getHours()).toBe(23);
    expect(new Date(nextMorningAt(t, -5)).getHours()).toBe(0);
  });
});

describe('setMorningLog reducer', () => {
  const log: MorningLog = { at: 100, hangover: 2, sleep: 1, regret: true };
  it('일치하는 기록에 morning을 붙인다', () => {
    const s = base({ history: [rec({ id: 'a' }), rec({ id: 'b' })] });
    const next = setMorningLog(s, 'b', log);
    expect(next.history.find((r) => r.id === 'b')?.morning).toEqual(log);
    expect(next.history.find((r) => r.id === 'a')?.morning).toBeUndefined();
  });
  it('기존 morning을 덮어쓴다', () => {
    const s = base({ history: [rec({ id: 'a', morning: { at: 1, hangover: 0 } })] });
    const next = setMorningLog(s, 'a', log);
    expect(next.history[0].morning).toEqual(log);
  });
  it('없는 id면 그대로', () => {
    const s = base({ history: [rec({ id: 'a' })] });
    expect(setMorningLog(s, 'zzz', log)).toBe(s);
  });
});

describe('morningInsight', () => {
  it('기록 3건 미만이면 null', () => {
    const h = [
      rec({ id: '1', count: 5, morning: { at: 1, hangover: 3 } }),
      rec({ id: '2', count: 2, morning: { at: 1, hangover: 0 } }),
    ];
    expect(morningInsight(h)).toBeNull();
  });

  it('숙취 심한 날 평균이 적은 날보다 높게 나온다', () => {
    const h = [
      rec({ id: '1', count: 8, morning: { at: 1, hangover: 3 } }),
      rec({ id: '2', count: 6, morning: { at: 1, hangover: 2 } }),
      rec({ id: '3', count: 2, morning: { at: 1, hangover: 0 } }),
      rec({ id: '4', count: 3, morning: { at: 1, hangover: 1 } }),
      rec({ id: '5', count: 1, morning: { at: 1, hangover: 0, regret: true } }),
    ];
    const ins = morningInsight(h)!;
    expect(ins.logged).toBe(5);
    expect(ins.hardN).toBe(2);
    expect(ins.easyN).toBe(3);
    expect(ins.hardAvg).toBe(7); // (8+6)/2
    expect(ins.easyAvg).toBeCloseTo(2); // (2+3+1)/3
    expect(ins.hardAvg).toBeGreaterThan(ins.easyAvg);
    expect(ins.regretN).toBe(1);
  });

  it('컨디션 없는 기록은 무시한다', () => {
    const h = [
      rec({ id: '1', count: 5, morning: { at: 1, hangover: 2 } }),
      rec({ id: '2', count: 4 }),
      rec({ id: '3', count: 3, morning: { at: 1, hangover: 0 } }),
      rec({ id: '4', count: 2, morning: { at: 1, hangover: 1 } }),
    ];
    expect(morningInsight(h)!.logged).toBe(3);
  });
});

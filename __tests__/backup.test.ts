import { serializeBackup, parseBackup, BACKUP_FORMAT } from '../src/backup';
import { DEFAULT_STATE, type AppState } from '../src/storage';

const sample: AppState = {
  ...DEFAULT_STATE,
  limit: 8,
  history: [{ id: 'x', endedAt: 123, count: 3, limit: 8 }],
  homeAddress: '서울 은평구',
  monthlyBudget: 300000,
};

describe('backup round-trip', () => {
  it('직렬화 후 파싱하면 동일 상태로 복원', () => {
    const text = serializeBackup(sample, 1700000000000);
    const restored = parseBackup(text);
    expect(restored.limit).toBe(8);
    expect(restored.history).toEqual(sample.history);
    expect(restored.homeAddress).toBe('서울 은평구');
    expect(restored.monthlyBudget).toBe(300000);
  });

  it('직렬화 결과는 format 태그를 포함', () => {
    expect(serializeBackup(sample, 0)).toContain(BACKUP_FORMAT);
  });
});

describe('parseBackup 검증', () => {
  it('JSON이 아니면 throw', () => {
    expect(() => parseBackup('이건 그냥 텍스트')).toThrow('JSON');
  });

  it('format 태그가 없으면 throw', () => {
    expect(() => parseBackup(JSON.stringify({ state: { limit: 5 } }))).toThrow('백업 파일');
  });

  it('누락 필드는 기본값으로 채운다', () => {
    const text = JSON.stringify({ format: BACKUP_FORMAT, version: 1, state: { limit: 9 } });
    const r = parseBackup(text);
    expect(r.limit).toBe(9);
    expect(r.difficulty).toBe(DEFAULT_STATE.difficulty); // 누락 → 기본값
    expect(r.fakeCall.callerName).toBe(DEFAULT_STATE.fakeCall.callerName); // 중첩도 방어
  });
});

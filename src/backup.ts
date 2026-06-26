// 백업 직렬화/파싱 (순수 — 네이티브 의존성 없음 → 테스트 가능).
import { DEFAULT_STATE, type AppState } from './storage';

export const BACKUP_FORMAT = 'brakepoint-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: string;
  version: number;
  exportedAt: number;
  state: AppState;
};

export function buildBackup(state: AppState, exportedAt: number): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, state };
}

export function serializeBackup(state: AppState, exportedAt: number): string {
  return JSON.stringify(buildBackup(state, exportedAt), null, 2);
}

// 백업 텍스트 → 복원용 AppState. 형식이 아니면 throw. 누락 필드는 기본값으로 방어.
export function parseBackup(text: string): AppState {
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('JSON 형식이 아니에요.');
  }
  if (!obj || obj.format !== BACKUP_FORMAT || typeof obj.state !== 'object' || !obj.state) {
    throw new Error('브레이크포인트 백업 파일이 아니에요.');
  }
  return {
    ...DEFAULT_STATE,
    ...obj.state,
    fakeCall: { ...DEFAULT_STATE.fakeCall, ...(obj.state.fakeCall ?? {}) },
  };
}

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import type { AppState } from './storage';
import { serializeBackup, parseBackup } from './backup';

export type ExportResult = { ok: true } | { ok: false; reason: 'unavailable' | 'error' };
export type ImportResult =
  | { ok: true; state: AppState }
  | { ok: false; reason: 'canceled' | 'error'; message?: string };

// 현재 상태를 JSON 파일로 써서 공유시트로 내보낸다.
export async function exportBackup(state: AppState, exportedAt: number, dateTag: string): Promise<ExportResult> {
  try {
    const file = new File(Paths.cache, `brakepoint-backup-${dateTag}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(serializeBackup(state, exportedAt));
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: '브레이크포인트 백업 내보내기',
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

// .json 파일을 골라 읽고 검증해 복원용 상태를 돌려준다.
export async function importBackup(): Promise<ImportResult> {
  try {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return { ok: false, reason: 'canceled' };
    const text = await new File(res.assets[0].uri).text();
    try {
      return { ok: true, state: parseBackup(text) };
    } catch (e) {
      return { ok: false, reason: 'error', message: e instanceof Error ? e.message : undefined };
    }
  } catch {
    return { ok: false, reason: 'error' };
  }
}

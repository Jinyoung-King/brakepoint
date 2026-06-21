import {
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export type ImportResult =
  | { ok: true; weightKg: number }
  | { ok: false; reason: 'unavailable' | 'denied' | 'no-data' | 'error' };

// Health Connect에서 최신 몸무게(kg)를 읽어온다. (삼성헬스가 HC에 동기화해둔 값)
export async function importWeightFromHealthConnect(): Promise<ImportResult> {
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: false, reason: 'unavailable' };

    await initialize();
    const granted = await requestPermission([{ accessType: 'read', recordType: 'Weight' }]);
    const hasWeight = granted.some((p) => 'recordType' in p && p.recordType === 'Weight');
    if (!hasWeight) return { ok: false, reason: 'denied' };

    const end = new Date();
    const start = new Date(end.getTime() - 365 * 24 * 3600 * 1000);
    const res = await readRecords('Weight', {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const recs = res.records;
    if (!recs.length) return { ok: false, reason: 'no-data' };

    const latest = recs[recs.length - 1]; // HC는 오래된→최신 순
    return { ok: true, weightKg: Math.round(latest.weight.inKilograms) };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

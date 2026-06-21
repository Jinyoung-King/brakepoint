import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export { openHealthConnectSettings };

export type ImportResult =
  | { ok: true; weightKg: number }
  | { ok: false; reason: 'unavailable' | 'denied' | 'no-data' | 'error' };

const hasWeightRead = (perms: unknown[]) =>
  perms.some((p) => {
    const o = p as { recordType?: string; accessType?: string };
    return o?.recordType === 'Weight' && o?.accessType === 'read';
  });

async function readLatestWeightKg(): Promise<number | null> {
  const end = new Date();
  const start = new Date(end.getTime() - 365 * 24 * 3600 * 1000);
  const res = await readRecords('Weight', {
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  const recs = res.records;
  if (!recs.length) return null;
  return Math.round(recs[recs.length - 1].weight.inKilograms); // 오래된→최신
}

// Health Connect에서 최신 몸무게(kg). 이미 허용돼 있으면 재요청 없이 바로 읽음.
export async function importWeightFromHealthConnect(): Promise<ImportResult> {
  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: false, reason: 'unavailable' };

    await initialize();

    let granted: unknown[] = await getGrantedPermissions();
    if (!hasWeightRead(granted)) {
      granted = await requestPermission([{ accessType: 'read', recordType: 'Weight' }]);
    }
    if (!hasWeightRead(granted)) return { ok: false, reason: 'denied' };

    const kg = await readLatestWeightKg();
    if (kg == null) return { ok: false, reason: 'no-data' };
    return { ok: true, weightKg: kg };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

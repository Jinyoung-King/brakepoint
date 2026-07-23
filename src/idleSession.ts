import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

import type { AppState } from './storage';
import { loadState, saveState } from './storage';

const CHANNEL = 'idle-session';
const ID = 'idle-session';

// 알림 탭 식별용 pressAction id. 탭하면 종료(정리) 모달을 연다(pendingEnd 재사용).
export const ACT_IDLE = 'idle-session-end';

// 방치 판정의 기준 시각: 마지막 잔(없으면 첫 잔), 그리고 "아직 마시는 중" 스누즈 중 더 최근.
export function idleBaseline(s: Pick<AppState, 'lastDrinkMs' | 'sessionStartMs' | 'idleSnoozeMs'>): number {
  return Math.max(s.lastDrinkMs ?? s.sessionStartMs ?? 0, s.idleSnoozeMs ?? 0);
}

// 방치 자동 감지가 켜져 있고 술자리가 진행 중이면 알림/확인이 떠야 할 시각(epoch ms). 아니면 null.
export function idleDueAt(
  s: Pick<AppState, 'drinkingMode' | 'count' | 'lastDrinkMs' | 'sessionStartMs' | 'idleSnoozeMs' | 'idleEndMin'>
): number | null {
  if (!s.drinkingMode || s.count <= 0 || !s.idleEndMin || s.idleEndMin <= 0) return null;
  const base = idleBaseline(s);
  if (base <= 0) return null;
  return base + s.idleEndMin * 60000;
}

// now 기준 방치 임계값을 넘겼는지.
export function isIdleDue(
  s: Pick<AppState, 'drinkingMode' | 'count' | 'lastDrinkMs' | 'sessionStartMs' | 'idleSnoozeMs' | 'idleEndMin'>,
  now: number
): boolean {
  const due = idleDueAt(s);
  return due != null && now >= due;
}

// 방치 확인 알림 1회 예약(기존 예약 덮어씀). dueAt이 이미 지났으면 곧바로(+1s) 뜨게.
export async function scheduleIdlePrompt(dueAt: number, now: number): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL,
      name: '술자리 방치 확인',
      importance: AndroidImportance.HIGH,
    });
    await notifee.createTriggerNotification(
      {
        id: ID,
        title: '술자리 끝났어요?',
        body: '한동안 잔이 늘지 않았어요. 끝났으면 눌러서 정리할게요.',
        data: { type: 'idle-session' },
        android: {
          channelId: CHANNEL,
          pressAction: { id: ACT_IDLE, launchActivity: 'default' },
          autoCancel: true,
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: Math.max(now + 1000, dueAt) }
    );
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export async function cancelIdlePrompt(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(ID);
    await notifee.cancelNotification(ID);
  } catch {}
}

// 백그라운드에서 방치 알림을 탭한 경우: 디스크에 pendingEnd만 세운다(앱 복귀 시 종료 모달).
export async function markPendingEndBg(): Promise<void> {
  try {
    const s = await loadState();
    if (s.drinkingMode && !s.pendingEnd) await saveState({ ...s, pendingEnd: true });
  } catch {}
}

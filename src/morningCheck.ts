import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

import { loadState, saveState } from './storage';

const CHANNEL = 'morning-check';
const ID = 'morning-check';

// 알림 탭 식별용 pressAction id. index.ts(백그라운드)·MorningCheckController(포그라운드)에서 공유.
export const ACT_MORNING = 'morning-check-open';

// now 기준, 다음으로 오는 hour시 00분의 epoch ms.
// 이미 오늘 그 시각을 지났으면 내일 그 시각. (새벽 2시 종료 → 오늘 아침 9시, 밤 11시 종료 → 내일 아침 9시)
export function nextMorningAt(now: number, hour: number): number {
  const h = Math.min(23, Math.max(0, Math.floor(hour)));
  const d = new Date(now);
  d.setHours(h, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

// 다음날 아침 hour시에 컨디션 체크인 알림 1회 예약(기존 예약은 덮어씀).
export async function scheduleMorningCheck(now: number, hour: number): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL,
      name: '아침 컨디션 체크인',
      importance: AndroidImportance.DEFAULT,
    });
    await notifee.createTriggerNotification(
      {
        id: ID,
        title: '오늘 아침 컨디션은?',
        body: '어젯밤 술자리, 지금 몸 상태를 탭 몇 번으로 기록해요.',
        // 커스텀 id로도 앱을 열려면 launchActivity 필요(ongoing.ts 종료 액션과 동일 패턴).
        android: { channelId: CHANNEL, pressAction: { id: ACT_MORNING, launchActivity: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: nextMorningAt(now, hour) }
    );
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export async function cancelMorningCheck(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(ID);
    await notifee.cancelNotification(ID);
  } catch {}
}

// 백그라운드/종료 상태에서 알림을 탭한 경우: React 트리가 없을 수 있어
// 디스크 상태에 pendingMorningCheck 플래그만 세워둔다. 포그라운드 복귀 시 Context가 흡수.
export async function markPendingMorningCheckBg(): Promise<void> {
  try {
    const s = await loadState();
    if (!s.pendingMorningCheck) await saveState({ ...s, pendingMorningCheck: true });
  } catch {}
}

import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

import { formatWeekReport, type WeekReport } from './stats';

const CHANNEL = 'weekly-report';
const ID = 'weekly-report';

// 다음 월요일 09:00에 지난주 요약 알림 1회 예약. 앱 열 때마다 재예약해 내용을 최신화한다.
export async function scheduleWeeklyReport(fireAt: number, report: WeekReport): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL,
      name: '주간 리포트',
      importance: AndroidImportance.DEFAULT,
    });
    await notifee.createTriggerNotification(
      {
        id: ID, // 동일 id라 재예약 시 이전 예약을 덮어씀
        title: '📊 지난주 음주 리포트',
        body: formatWeekReport(report),
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: fireAt }
    );
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export async function cancelWeeklyReport(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(ID);
    await notifee.cancelNotification(ID);
  } catch {}
}

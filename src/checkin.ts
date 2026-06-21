import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';

const CHANNEL = 'home-checkin';
const ID = 'home-checkin';

// 음주모드 종료 후 delayMin 뒤 "집에 잘 도착했어요?" 알림 1회 예약
export async function scheduleCheckin(delayMin: number): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL,
      name: '귀가 체크인',
      importance: AndroidImportance.DEFAULT,
    });
    await notifee.createTriggerNotification(
      {
        id: ID,
        title: '집에 잘 도착했어요?',
        body: '도착했으면 앱에서 "집 도착"을 눌러 알림을 꺼요.',
        android: { channelId: CHANNEL, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: Date.now() + Math.max(1, delayMin) * 60000 }
    );
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export async function cancelCheckin(): Promise<void> {
  try {
    await notifee.cancelTriggerNotification(ID);
    await notifee.cancelNotification(ID);
  } catch {}
}

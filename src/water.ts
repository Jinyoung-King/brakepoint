import notifee, { AndroidImportance } from '@notifee/react-native';

const CHANNEL = 'water-reminder';

// 잔 사이 물 권유. 블로킹 Alert 대신 헤드업 알림으로 (비블로킹, 잠깐 떴다 사라짐).
export async function notifyWater(): Promise<void> {
  try {
    await notifee.createChannel({
      id: CHANNEL,
      name: '물 알림',
      importance: AndroidImportance.HIGH,
    });
    await notifee.displayNotification({
      id: 'water-reminder', // 고정 id로 중복 누적 방지
      title: '💧 물 한 잔 마셔요',
      body: '술 사이에 물 한 잔이면 다음날이 한결 나아요.',
      android: {
        channelId: CHANNEL,
        importance: AndroidImportance.HIGH,
        pressAction: { id: 'default' },
        timeoutAfter: 60000, // 1분 뒤 자동 제거
        autoCancel: true,
      },
    });
  } catch {
    // 알림 실패는 조용히 무시
  }
}

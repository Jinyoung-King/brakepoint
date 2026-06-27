import notifee, { AndroidImportance, type Notification } from '@notifee/react-native';

import type { AppState } from './storage';
import { loadState, saveState } from './storage';
import { addDrink } from './state/reducers';
import { alcoholGrams, estimateBac, hoursUntil, fmtHours, DRIVE_LIMIT } from './bac';
import { brakeCountsFor, crossesBrake } from './brake';
import { notifyWater } from './water';

// 음주 중 상태표시줄에 상주하는 알림. 앱을 안 열고도 잔을 더하고 BAC를 본다.
// 워치(Wear OS)에도 자동 미러링돼 워치에서 바로 잔 추가가 된다.
export const ONGOING_CHANNEL = 'drinking-session';
export const ONGOING_ID = 'drinking-session';
export const ACT_DRINK = 'ongoing-drink';
export const ACT_END = 'ongoing-end';

// 브레이크 도달 시 잠금화면이어도 앱을 깨우는 알림 (가짜전화와 동일한 풀스크린 인텐트 방식).
const GATE_CHANNEL = 'brake-gate';
export const GATE_ALERT_ID = 'ongoing-gate';

// 알림 제목/본문 — 잔/한도 + 혈중알코올(+운전 가능까지).
export function ongoingContent(s: AppState, now: number): { title: string; body: string } {
  const { count, limit, unit, drinkType, weightKg, sex, sessionStartMs } = s;
  const hoursSince = sessionStartMs ? (now - sessionStartMs) / 3600000 : 0;
  const grams = alcoholGrams(count, unit, drinkType);
  const bac = estimateBac({ grams, weightKg, sex, hoursSinceStart: hoursSince });
  const title = `🍺 ${count} / ${limit}${unit}`;
  let body: string;
  if (count <= 0) body = '첫 잔을 누르면 페이스·혈중알코올이 여기 표시돼요.';
  else if (bac < DRIVE_LIMIT) body = `혈중알코올 ${bac.toFixed(3)}% · 추정치`;
  else body = `혈중알코올 ${bac.toFixed(3)}% · 운전 가능까지 ${fmtHours(hoursUntil(bac, DRIVE_LIMIT))}`;
  return { title, body };
}

async function ensureChannel(): Promise<void> {
  await notifee.createChannel({
    id: ONGOING_CHANNEL,
    name: '술자리 진행 중',
    importance: AndroidImportance.LOW, // 소리/헤드업 없이 상태표시줄에 조용히 상주
  });
}

function buildOngoing(s: AppState, now: number): Notification {
  const { title, body } = ongoingContent(s, now);
  return {
    id: ONGOING_ID,
    title,
    body,
    data: { type: 'ongoing' },
    android: {
      channelId: ONGOING_CHANNEL,
      importance: AndroidImportance.LOW,
      ongoing: true, // 스와이프로 못 지움 (술자리 끝날 때까지 상주)
      onlyAlertOnce: true, // 갱신해도 다시 알리지 않음
      // 알림 본문 탭 → 앱 열기
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: [
        { title: `+1${s.unit}`, pressAction: { id: ACT_DRINK } }, // launchActivity 없음 → 앱 안 열고 처리
        { title: '종료', pressAction: { id: ACT_END, launchActivity: 'default' } },
      ],
    },
  };
}

export async function displayOngoing(s: AppState, now: number): Promise<void> {
  try {
    await ensureChannel();
    await notifee.displayNotification(buildOngoing(s, now));
  } catch {
    // 알림 실패는 조용히 무시
  }
}

export async function cancelOngoing(): Promise<void> {
  try {
    await notifee.cancelNotification(ONGOING_ID);
  } catch {}
}

// 브레이크 도달 알림: 잠금화면 위로 떠서 탭/전체화면으로 앱을 깨운다.
// 앱 복귀 시 pendingGate 플래그를 보고 인지게이트로 이동한다(OngoingController).
export async function displayGateAlert(): Promise<void> {
  try {
    await notifee.createChannel({
      id: GATE_CHANNEL,
      name: '브레이크 알림',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
    await notifee.displayNotification({
      id: GATE_ALERT_ID,
      title: '🚦 브레이크 — 잠깐!',
      body: '페이스 체크가 필요해요. 눌러서 확인하세요.',
      data: { type: 'ongoing-gate' },
      android: {
        channelId: GATE_CHANNEL,
        importance: AndroidImportance.HIGH,
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        autoCancel: true,
      },
    });
  } catch {}
}

export async function cancelGateAlert(): Promise<void> {
  try {
    await notifee.cancelNotification(GATE_ALERT_ID);
  } catch {}
}

// 백그라운드/종료 상태에서 알림 액션을 받았을 때(React 트리 없음): 디스크 상태를
// 직접 read→reduce→save 하고 알림을 갱신한다. 앱 복귀 시 Context가 디스크에서
// 다시 로드해 메모리와 화면을 맞춘다.
// 주의: 백그라운드에선 "다음날 일정" 임계값 강화(morning tighten)를 알 수 없어
// 기본 brakePercents 기준으로 브레이크를 판정한다(화면 탭은 강화 반영).
export async function handleOngoingActionBg(actionId: string, now: number): Promise<void> {
  if (actionId === ACT_END) {
    // 종료는 launchActivity로 앱이 열리며, 장소·술값 입력 모달을 띄워야 하므로
    // 헤드리스에서 끝내지 않고 플래그만 세운다(앱 복귀 후 HomeScreen이 처리).
    const s = await loadState();
    if (s.drinkingMode) await saveState({ ...s, pendingEnd: true });
    return;
  }
  if (actionId !== ACT_DRINK) return;

  const s = await loadState();
  if (!s.drinkingMode) return;
  const prev = s.count;
  const next = prev + 1;
  let ns = addDrink(s, 1, now);
  const brakeCounts = brakeCountsFor(ns.limit, ns.brakePercents);
  const crossed = crossesBrake({
    prev,
    next,
    limit: ns.limit,
    brakeCounts,
    repeatEveryDrinks: ns.repeatEveryDrinks,
  });
  if (crossed) ns = { ...ns, pendingGate: true };
  await saveState(ns);

  // 물 알림: waterEvery 배수를 넘으면 헤드업 (화면 탭과 동일 규칙)
  if (ns.waterEvery > 0 && Math.floor(prev / ns.waterEvery) < Math.floor(next / ns.waterEvery)) {
    await notifyWater();
  }

  if (crossed) await displayGateAlert();
  await displayOngoing(ns, now);
}

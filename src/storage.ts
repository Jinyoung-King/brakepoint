import AsyncStorage from '@react-native-async-storage/async-storage';

// 앱 전역 영속 상태. 단계가 진행되면 (가짜전화 설정, 난이도 등) 여기에 필드 추가.
export type Difficulty = 'easy' | 'normal' | 'hard';

export type FakeCallConfig = {
  callerName: string;
  callerNumber: string;
  photoUri: string | null; // 발신자 사진 (없으면 기본 아바타)
  periodMin: number; // 가짜 전화 주기(분)
};

export type SessionRecord = {
  id: string;
  endedAt: number; // 종료 시각 (epoch ms)
  count: number; // 그 술자리에서 마신 잔수
  limit: number; // 그때 설정돼 있던 한계
};

export type AppState = {
  limit: number; // 목표 한계 잔수 N
  count: number; // 현재 마신 잔수
  drinkingMode: boolean; // 음주모드 ON/OFF
  difficulty: Difficulty; // 인지 게이트 난이도
  fakeCall: FakeCallConfig; // 가짜 전화 설정
  history: SessionRecord[]; // 종료된 술자리 기록 (최신순)
};

export const DEFAULT_STATE: AppState = {
  limit: 5,
  count: 0,
  drinkingMode: false,
  difficulty: 'normal',
  fakeCall: {
    callerName: '엄마',
    callerNumber: '010-1234-5678',
    photoUri: null,
    periodMin: 45,
  },
  history: [],
};

const KEY = 'brakepoint:appState';

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    // 저장된 값 위에 기본값을 깔아 누락 필드를 방어 (스키마 확장 대비).
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      fakeCall: { ...DEFAULT_STATE.fakeCall, ...(parsed.fakeCall ?? {}) },
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

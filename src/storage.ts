import AsyncStorage from '@react-native-async-storage/async-storage';

// 앱 전역 영속 상태. 단계가 진행되면 (가짜전화 설정, 난이도 등) 여기에 필드 추가.
export type Difficulty = 'easy' | 'normal' | 'hard';

export type FakeCallConfig = {
  callerName: string;
  callerNumber: string;
  photoUri: string | null; // 발신자 사진 (없으면 기본 아바타)
  periodMin: number; // 가짜 전화 주기(분)
};

export type DrinkUnit = '잔' | '병' | '캔';

export type ThemeMode = 'dark' | 'light' | 'system';

export type Sex = 'male' | 'female';

export type DrinkType = '소주' | '맥주' | '와인' | '양주';

export type DrinkEvent = { t: number; n: number }; // 마신 시각(epoch ms), 그때 추가한 양

export type SessionRecord = {
  id: string;
  endedAt: number; // 종료 시각 (epoch ms)
  count: number; // 그 술자리에서 마신 양
  limit: number; // 그때 설정돼 있던 한계
  unit?: DrinkUnit; // 그때 단위
  cigs?: number; // 그 술자리 흡연 개비
  place?: string; // 장소
  memo?: string; // 한줄 메모
  round?: number; // 그날 N차
  events?: DrinkEvent[]; // 시점별 음주 타임라인
  cost?: number; // 술값(원)
};

export type AppState = {
  limit: number; // 목표 한계 잔수 N
  count: number; // 현재 마신 잔수
  drinkingMode: boolean; // 음주모드 ON/OFF
  difficulty: Difficulty; // 인지 게이트 난이도
  fakeCall: FakeCallConfig; // 가짜 전화 설정
  history: SessionRecord[]; // 종료된 술자리 기록 (최신순)
  brakePercents: number[]; // 브레이크 임계값(주량 대비 %). 각 지점에서 인지게이트 발동
  repeatEveryDrinks: number; // 100% 초과 후 N잔마다 인지게이트
  onboarded: boolean; // 첫 실행 설정 완료 여부
  unit: DrinkUnit; // 카운트 단위 (잔/병/캔)
  bottleToGlasses: number; // 1병 = N잔 환산 (잔 카운트 기준)
  cigs: number; // 현재 술자리 흡연 개비
  smokingEnabled: boolean; // 흡연 트래킹 표시 여부
  calendarSync: boolean; // 다음날 일정 연동(브레이크 강화)
  theme: ThemeMode; // 앱 테마 (다크/라이트/시스템)
  sex: Sex; // BAC 추정용
  weightKg: number; // BAC 추정용 체중
  drinkType: DrinkType; // 술 종류 (BAC 알코올량 추정)
  homeAddress: string; // 안전 귀가용 집 주소
  homeLat: number | null; // 집 좌표(지오코딩 캐시)
  homeLng: number | null;
  sessionStartMs: number | null; // 이번 술자리 첫 잔 시각 (BAC 경과시간)
  lastDrinkMs: number | null; // 마지막 잔 시각 (잔 간격)
  drinkEvents: DrinkEvent[]; // 이번 술자리 시점별 음주 기록
  waterEvery: number; // 몇 잔마다 물 알림 (0=끔)
  weeklyGoalSessions: number; // 주간 목표 술자리 횟수 (0=끔)
  checkinEnabled: boolean; // 귀가 체크인 알림
  checkinDelayMin: number; // 음주모드 종료 후 체크인까지(분)
  monthlyBudget: number; // 월 술값 예산(원, 0=끔)
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
  brakePercents: [60, 80],
  repeatEveryDrinks: 3,
  onboarded: false,
  unit: '잔',
  bottleToGlasses: 7,
  cigs: 0,
  smokingEnabled: true,
  calendarSync: true,
  theme: 'dark',
  sex: 'male',
  weightKg: 70,
  drinkType: '소주',
  homeAddress: '',
  homeLat: null,
  homeLng: null,
  sessionStartMs: null,
  lastDrinkMs: null,
  drinkEvents: [],
  waterEvery: 3,
  weeklyGoalSessions: 2,
  checkinEnabled: true,
  checkinDelayMin: 60,
  monthlyBudget: 0,
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

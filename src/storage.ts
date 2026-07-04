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

// 홈 진행률 게이지 스타일 (기본 바 / 게임 체력바 류)
export type GaugeStyle = 'classic' | 'hp' | 'hearts' | 'boss' | 'mp' | 'tacho' | 'protoss';

// 홈 위젯 색상 테마
export type WidgetTheme = 'dark' | 'light' | 'blue' | 'pink';

export type Sex = 'male' | 'female';

// 기본 5종 + 사용자가 등록한 커스텀 주종(막걸리·하이볼 등). 커스텀은 이름이 곧 식별자라 string으로 연다.
export type DrinkType = string;
export const BUILTIN_DRINK_TYPES = ['소주', '맥주', '와인', '양주', '청하'] as const;

// 사용자 정의 주종: 도수(%)·용량(ml)로 1잔당 순알코올 g을 계산해 저장.
export type CustomDrink = { id: string; name: string; abv: number; ml: number; grams: number };

// 마신 시각(epoch ms), 그때 추가한 양, 그리고 그때의 주종/단위(섞어 마실 때 BAC 정확도용).
// type/unit은 구버전 기록 호환을 위해 optional — 없으면 세션 기본값으로 대체.
export type DrinkEvent = { t: number; n: number; type?: DrinkType; unit?: DrinkUnit };

export type SessionRecord = {
  id: string;
  endedAt: number; // 종료 시각 (epoch ms)
  count: number; // 그 술자리에서 마신 양
  limit: number; // 그때 설정돼 있던 한계
  unit?: DrinkUnit; // 그때 단위
  cigs?: number; // 그 술자리 흡연 개비
  water?: number; // 그 술자리 마신 물 잔수
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
  water: number; // 현재 술자리 마신 물 잔수
  smokingEnabled: boolean; // 흡연 트래킹 표시 여부
  calendarSync: boolean; // 다음날 일정 연동(브레이크 강화)
  theme: ThemeMode; // 앱 테마 (다크/라이트/시스템)
  sex: Sex; // BAC 추정용
  weightKg: number; // BAC 추정용 체중
  drinkType: DrinkType; // 술 종류 (BAC 알코올량 추정)
  customDrinks: CustomDrink[]; // 사용자 등록 주종
  homeAddress: string; // 안전 귀가용 집 주소
  homeLat: number | null; // 집 좌표(지오코딩 캐시)
  homeLng: number | null;
  sessionStartMs: number | null; // 이번 술자리 첫 잔 시각 (BAC 경과시간)
  lastDrinkMs: number | null; // 마지막 잔 시각 (잔 간격)
  drinkEvents: DrinkEvent[]; // 이번 술자리 시점별 음주 기록
  waterEvery: number; // 몇 잔마다 물 알림 (0=끔)
  waterStartAt: number; // 이 잔수 이하에선 물 알림 안 뜸(초반 스킵, 0=처음부터)
  weeklyGoalSessions: number; // 주간 목표 술자리 횟수 (0=끔)
  checkinEnabled: boolean; // 귀가 체크인 알림
  checkinDelayMin: number; // 음주모드 종료 후 체크인까지(분)
  monthlyBudget: number; // 월 술값 예산(원, 0=끔)
  weeklyReportEnabled: boolean; // 매주 월요일 아침 지난주 요약 알림
  gaugeStyle: GaugeStyle; // 홈 진행률 게이지 스타일
  tipsyFaceEnabled: boolean; // 음주 중 취기 캐릭터(얼굴) 표시
  widgetTheme: WidgetTheme; // 홈 위젯 색상 테마
  ongoingNotifEnabled: boolean; // 음주 중 상시 알림(잔/BAC + 잔+1·종료 액션)
  pendingGate: boolean; // 백그라운드에서 알림으로 잔 추가 시 브레이크 도달 → 앱 복귀 후 게이트
  pendingEnd: boolean; // 알림 "종료" 액션 → 앱 복귀 후 종료 모달 열기
  schemaVersion: number; // 저장 스키마 버전 (마이그레이션 기준점)
};

// 저장 스키마 버전. 필드 이름 변경/타입 변경/데이터 변형이 필요할 때 올리고 MIGRATIONS에 단계 추가.
// (단순 필드 추가는 DEFAULT_STATE 병합이 처리하므로 버전을 안 올려도 됨)
export const SCHEMA_VERSION = 1;

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
  water: 0,
  smokingEnabled: true,
  calendarSync: true,
  theme: 'dark',
  sex: 'male',
  weightKg: 70,
  drinkType: '소주',
  customDrinks: [],
  homeAddress: '',
  homeLat: null,
  homeLng: null,
  sessionStartMs: null,
  lastDrinkMs: null,
  drinkEvents: [],
  waterEvery: 3,
  waterStartAt: 0,
  weeklyGoalSessions: 2,
  checkinEnabled: true,
  checkinDelayMin: 60,
  monthlyBudget: 0,
  weeklyReportEnabled: true,
  gaugeStyle: 'classic',
  tipsyFaceEnabled: true,
  widgetTheme: 'dark',
  ongoingNotifEnabled: true,
  pendingGate: false,
  pendingEnd: false,
  schemaVersion: SCHEMA_VERSION,
};

const KEY = 'brakepoint:appState';

// 버전별 마이그레이션: key = 도달 목표 버전. 이전 버전 데이터를 받아 그 버전으로 올린다.
// 예) 필드 rename: 2: (s) => ({ ...s, newName: s.oldName, oldName: undefined })
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  // 아직 실제 마이그레이션 없음. 스키마가 바뀌면 여기에 단계별로 추가.
};

// 저장 데이터(구버전 포함) → 현재 스키마의 AppState. 순수 함수(테스트 가능).
// 1) 버전을 순차로 올리며 MIGRATIONS 적용 → 2) 기본값 병합으로 누락/손상 필드 방어.
export function migrateAppState(raw: unknown): AppState {
  let s: Record<string, unknown> = raw && typeof raw === 'object' ? { ...(raw as object) } : {};
  let v = typeof s.schemaVersion === 'number' ? s.schemaVersion : 0;
  while (v < SCHEMA_VERSION) {
    const fn = MIGRATIONS[v + 1];
    if (fn) s = fn(s);
    v += 1;
  }
  const fakeCall = s.fakeCall && typeof s.fakeCall === 'object' ? s.fakeCall : {};
  return {
    ...DEFAULT_STATE,
    ...s,
    schemaVersion: SCHEMA_VERSION,
    // 중첩/배열은 형태가 깨져 있어도 기본값으로 방어 (부분 손상 대비).
    fakeCall: { ...DEFAULT_STATE.fakeCall, ...(fakeCall as object) },
    history: Array.isArray(s.history) ? (s.history as AppState['history']) : [],
    drinkEvents: Array.isArray(s.drinkEvents) ? (s.drinkEvents as AppState['drinkEvents']) : [],
    customDrinks: Array.isArray(s.customDrinks) ? (s.customDrinks as AppState['customDrinks']) : [],
  };
}

export async function loadState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    return migrateAppState(JSON.parse(raw));
  } catch {
    return DEFAULT_STATE;
  }
}

export async function saveState(state: AppState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

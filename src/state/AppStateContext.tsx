import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  type AppState,
  type Difficulty,
  type DrinkUnit,
  type FakeCallConfig,
  type ThemeMode,
  type Sex,
  type DrinkType,
  DEFAULT_STATE,
  loadState,
  saveState,
} from '../storage';
import * as reducers from './reducers';

type AppStateContextValue = {
  state: AppState;
  ready: boolean; // AsyncStorage 로드 완료 여부 (초기 깜빡임 방지)
  addDrink: (n?: number) => void;
  undoDrink: () => void; // 직전 추가(+1잔/+1병) 되돌리기
  addCig: () => void;
  endSession: (extra?: { place?: string; memo?: string; cost?: number }) => void; // 현재 술자리를 기록에 저장하고 초기화
  addManualRecord: (r: {
    count: number;
    limit: number;
    daysAgo: number;
    time?: string;
    place?: string;
    memo?: string;
    cost?: number;
  }) => void; // 지난 술자리 수동 추가
  clearHistory: () => void;
  setLimit: (limit: number) => void;
  setDrinkingMode: (on: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setUnit: (unit: DrinkUnit) => void;
  setBottleToGlasses: (n: number) => void;
  setCalendarSync: (on: boolean) => void;
  setSmokingEnabled: (on: boolean) => void;
  setMonthlyBudget: (won: number) => void;
  setTheme: (theme: ThemeMode) => void;
  setSex: (sex: Sex) => void;
  setWeightKg: (kg: number) => void;
  setDrinkType: (type: DrinkType) => void;
  setHomeAddress: (addr: string) => void;
  setHomeCoords: (lat: number, lng: number) => void;
  setWaterEvery: (n: number) => void;
  setWeeklyGoalSessions: (n: number) => void;
  setCheckinEnabled: (on: boolean) => void;
  setCheckinDelayMin: (min: number) => void;
  updateFakeCall: (patch: Partial<FakeCallConfig>) => void;
  setBrakePercents: (percents: number[]) => void;
  setRepeatEveryDrinks: (n: number) => void;
  completeOnboarding: () => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  // 최초 1회 디스크에서 로드
  useEffect(() => {
    loadState().then((s) => {
      setState(s);
      loaded.current = true;
      setReady(true);
    });
  }, []);

  // 상태 변경 시 영속화 (로드 끝난 뒤부터)
  useEffect(() => {
    if (loaded.current) saveState(state);
  }, [state]);

  const value: AppStateContextValue = {
    state,
    ready,
    addDrink: (n = 1) => setState((s) => reducers.addDrink(s, n, Date.now())),
    undoDrink: () => setState((s) => reducers.undoDrink(s)),
    addCig: () => setState((s) => reducers.addCig(s)),
    endSession: (extra) => setState((s) => reducers.endSession(s, extra, Date.now())),
    addManualRecord: (r) => setState((s) => reducers.addManualRecord(s, r, Date.now())),
    clearHistory: () => setState((s) => ({ ...s, history: [] })),
    setLimit: (limit) => setState((s) => ({ ...s, limit })),
    setDrinkingMode: (drinkingMode) => setState((s) => ({ ...s, drinkingMode })),
    setDifficulty: (difficulty) => setState((s) => ({ ...s, difficulty })),
    setUnit: (unit) => setState((s) => ({ ...s, unit })),
    setBottleToGlasses: (bottleToGlasses) => setState((s) => ({ ...s, bottleToGlasses })),
    setCalendarSync: (calendarSync) => setState((s) => ({ ...s, calendarSync })),
    setSmokingEnabled: (smokingEnabled) => setState((s) => ({ ...s, smokingEnabled })),
    setMonthlyBudget: (monthlyBudget) => setState((s) => ({ ...s, monthlyBudget })),
    setTheme: (theme) => setState((s) => ({ ...s, theme })),
    setSex: (sex) => setState((s) => ({ ...s, sex })),
    setWeightKg: (weightKg) => setState((s) => ({ ...s, weightKg })),
    setDrinkType: (drinkType) => setState((s) => ({ ...s, drinkType })),
    setHomeAddress: (homeAddress) => setState((s) => ({ ...s, homeAddress, homeLat: null, homeLng: null })),
    setHomeCoords: (homeLat, homeLng) => setState((s) => ({ ...s, homeLat, homeLng })),
    setWaterEvery: (waterEvery) => setState((s) => ({ ...s, waterEvery })),
    setWeeklyGoalSessions: (weeklyGoalSessions) => setState((s) => ({ ...s, weeklyGoalSessions })),
    setCheckinEnabled: (checkinEnabled) => setState((s) => ({ ...s, checkinEnabled })),
    setCheckinDelayMin: (checkinDelayMin) => setState((s) => ({ ...s, checkinDelayMin })),
    updateFakeCall: (patch) => setState((s) => ({ ...s, fakeCall: { ...s.fakeCall, ...patch } })),
    setBrakePercents: (brakePercents) => setState((s) => ({ ...s, brakePercents })),
    setRepeatEveryDrinks: (repeatEveryDrinks) => setState((s) => ({ ...s, repeatEveryDrinks })),
    completeOnboarding: () => setState((s) => ({ ...s, onboarded: true })),
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

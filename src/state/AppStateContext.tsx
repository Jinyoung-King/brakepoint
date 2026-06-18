import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  type AppState,
  type Difficulty,
  type FakeCallConfig,
  DEFAULT_STATE,
  loadState,
  saveState,
} from '../storage';

type AppStateContextValue = {
  state: AppState;
  ready: boolean; // AsyncStorage 로드 완료 여부 (초기 깜빡임 방지)
  addDrink: () => void;
  endSession: () => void; // 현재 술자리를 기록에 저장하고 잔수 초기화
  clearHistory: () => void;
  setLimit: (limit: number) => void;
  setDrinkingMode: (on: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
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
    addDrink: () => setState((s) => ({ ...s, count: s.count + 1 })),
    endSession: () =>
      setState((s) => {
        if (s.count <= 0) return s;
        const rec = { id: String(Date.now()), endedAt: Date.now(), count: s.count, limit: s.limit };
        return { ...s, count: 0, history: [rec, ...s.history] };
      }),
    clearHistory: () => setState((s) => ({ ...s, history: [] })),
    setLimit: (limit) => setState((s) => ({ ...s, limit })),
    setDrinkingMode: (drinkingMode) => setState((s) => ({ ...s, drinkingMode })),
    setDifficulty: (difficulty) => setState((s) => ({ ...s, difficulty })),
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

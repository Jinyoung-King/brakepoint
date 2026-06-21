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

type AppStateContextValue = {
  state: AppState;
  ready: boolean; // AsyncStorage 로드 완료 여부 (초기 깜빡임 방지)
  addDrink: (n?: number) => void;
  undoDrink: () => void; // 직전 추가(+1잔/+1병) 되돌리기
  addCig: () => void;
  endSession: (extra?: { place?: string; memo?: string }) => void; // 현재 술자리를 기록에 저장하고 초기화
  addManualRecord: (r: {
    count: number;
    limit: number;
    daysAgo: number;
    time?: string;
    place?: string;
    memo?: string;
  }) => void; // 지난 술자리 수동 추가
  clearHistory: () => void;
  setLimit: (limit: number) => void;
  setDrinkingMode: (on: boolean) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  setUnit: (unit: DrinkUnit) => void;
  setBottleToGlasses: (n: number) => void;
  setCalendarSync: (on: boolean) => void;
  setSmokingEnabled: (on: boolean) => void;
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
    addDrink: (n = 1) =>
      setState((s) => {
        const now = Date.now();
        return {
          ...s,
          count: s.count + n,
          lastDrinkMs: now,
          sessionStartMs: s.sessionStartMs ?? now,
          drinkEvents: [...s.drinkEvents, { t: now, n }],
        };
      }),
    undoDrink: () =>
      setState((s) => {
        if (s.count <= 0 || s.drinkEvents.length === 0) return s;
        const events = s.drinkEvents.slice(0, -1);
        const last = s.drinkEvents[s.drinkEvents.length - 1];
        const count = Math.max(0, s.count - last.n);
        return {
          ...s,
          count,
          drinkEvents: events,
          lastDrinkMs: events.length ? events[events.length - 1].t : null,
          sessionStartMs: count > 0 ? s.sessionStartMs : null,
        };
      }),
    addCig: () => setState((s) => ({ ...s, cigs: s.cigs + 1 })),
    endSession: (extra) =>
      setState((s) => {
        if (s.count <= 0 && s.cigs <= 0) return s;
        const now = Date.now();
        const d = new Date(now);
        const sameDay = (ms: number) => {
          const x = new Date(ms);
          return (
            x.getFullYear() === d.getFullYear() &&
            x.getMonth() === d.getMonth() &&
            x.getDate() === d.getDate()
          );
        };
        const round = s.history.filter((r) => sameDay(r.endedAt)).length + 1;
        const rec = {
          id: String(now),
          endedAt: now,
          count: s.count,
          limit: s.limit,
          unit: s.unit,
          cigs: s.cigs,
          place: extra?.place?.trim() || undefined,
          memo: extra?.memo?.trim() || undefined,
          round,
          events: s.drinkEvents,
        };
        return {
          ...s,
          count: 0,
          cigs: 0,
          sessionStartMs: null,
          lastDrinkMs: null,
          drinkEvents: [],
          history: [rec, ...s.history],
        };
      }),
    addManualRecord: (r) =>
      setState((s) => {
        const d = new Date();
        d.setDate(d.getDate() - Math.max(0, Math.floor(r.daysAgo)));
        const [hh, mm] = (r.time || '').split(':').map((x) => parseInt(x, 10));
        d.setHours(Number.isFinite(hh) ? hh : 21, Number.isFinite(mm) ? mm : 0, 0, 0);
        const endedAt = d.getTime();
        const sameDay = (a: number, b: number) => {
          const x = new Date(a);
          const y = new Date(b);
          return (
            x.getFullYear() === y.getFullYear() &&
            x.getMonth() === y.getMonth() &&
            x.getDate() === y.getDate()
          );
        };
        const round = s.history.filter((rr) => sameDay(rr.endedAt, endedAt)).length + 1;
        const rec = {
          id: `m-${endedAt}-${s.history.length}`,
          endedAt,
          count: r.count,
          limit: r.limit,
          unit: s.unit,
          place: r.place?.trim() || undefined,
          memo: r.memo?.trim() || undefined,
          round,
          events: [],
        };
        return { ...s, history: [rec, ...s.history].sort((a, b) => b.endedAt - a.endedAt) };
      }),
    clearHistory: () => setState((s) => ({ ...s, history: [] })),
    setLimit: (limit) => setState((s) => ({ ...s, limit })),
    setDrinkingMode: (drinkingMode) => setState((s) => ({ ...s, drinkingMode })),
    setDifficulty: (difficulty) => setState((s) => ({ ...s, difficulty })),
    setUnit: (unit) => setState((s) => ({ ...s, unit })),
    setBottleToGlasses: (bottleToGlasses) => setState((s) => ({ ...s, bottleToGlasses })),
    setCalendarSync: (calendarSync) => setState((s) => ({ ...s, calendarSync })),
    setSmokingEnabled: (smokingEnabled) => setState((s) => ({ ...s, smokingEnabled })),
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

import { planOngoingAction, ACT_DRINK, ACT_END } from '../src/ongoingPlan';
import { DEFAULT_STATE, type AppState, type CustomDrink } from '../src/storage';

const base = (over: Partial<AppState> = {}): AppState => ({ ...DEFAULT_STATE, drinkingMode: true, ...over });
const T = new Date(2026, 5, 24, 21, 0, 0).getTime();

describe('planOngoingAction (상시알림 백그라운드 결정)', () => {
  it('음주모드 아니면 아무것도 안 함(+1/종료 모두 no-op)', () => {
    const off = base({ drinkingMode: false });
    expect(planOngoingAction(off, ACT_DRINK, T).save).toBeNull();
    expect(planOngoingAction(off, ACT_END, T).save).toBeNull();
  });

  it('알 수 없는 액션은 no-op', () => {
    expect(planOngoingAction(base(), 'whatever', T)).toEqual({ save: null, notifyWater: false, gate: false, refreshOngoing: false });
  });

  it('종료 액션은 pendingEnd 플래그만 세우고 알림은 안 건드림', () => {
    const p = planOngoingAction(base({ count: 2 }), ACT_END, T);
    expect(p.save?.pendingEnd).toBe(true);
    expect(p.refreshOngoing).toBe(false);
    expect(p.gate).toBe(false);
  });

  it('+1잔: count 증가 + 상시알림 갱신', () => {
    const p = planOngoingAction(base({ count: 1, drinkEvents: [{ t: T, n: 1 }] }), ACT_DRINK, T);
    expect(p.save?.count).toBe(2);
    expect(p.refreshOngoing).toBe(true);
  });

  it('물 알림 배수(waterEvery)를 넘으면 notifyWater=true', () => {
    // count 2→3, waterEvery 3, 시작잔수 0 → 3잔째에 물 알림
    const p = planOngoingAction(base({ count: 2, waterEvery: 3, waterStartAt: 0, drinkEvents: [{ t: T, n: 1 }] }), ACT_DRINK, T);
    expect(p.notifyWater).toBe(true);
  });

  it('브레이크 지점 도달 시 gate=true + pendingGate 저장', () => {
    // limit5·[60,80] → 브레이크 3,4잔. 이미 2표준잔 → +1로 3 도달
    const s = base({ limit: 5, brakePercents: [60, 80], drinkEvents: [{ t: T, n: 2, type: '소주', unit: '잔' }] });
    const p = planOngoingAction(s, ACT_DRINK, T);
    expect(p.gate).toBe(true);
    expect(p.save?.pendingGate).toBe(true);
  });

  it('커스텀 주종 도수를 반영해 브레이크를 판정한다(헤드리스 경로 버그 방지)', () => {
    const customDrinks: CustomDrink[] = [{ id: 'c1', name: '폭탄주', abv: 20, ml: 250, grams: 40 }];
    // 폭탄주 1잔=40g=5표준잔 → 첫 잔에 limit5·브레이크 넘김
    const withCustom = base({ limit: 5, brakePercents: [60, 80], drinkType: '폭탄주', customDrinks, drinkEvents: [] });
    expect(planOngoingAction(withCustom, ACT_DRINK, T).gate).toBe(true);
    // 같은 상황이지만 커스텀 미등록(폴백 8g=1표준잔)이면 첫 잔엔 안 넘김
    const noCustom = base({ limit: 5, brakePercents: [60, 80], drinkType: '폭탄주', customDrinks: [], drinkEvents: [] });
    expect(planOngoingAction(noCustom, ACT_DRINK, T).gate).toBe(false);
  });
});

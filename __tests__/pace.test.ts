import { drinkingPace } from '../src/pace';
import type { DrinkEvent } from '../src/storage';

const T = new Date(2026, 6, 23, 22, 0, 0).getTime();
const MIN = 60000;
// 소주 1잔 = 8g = 표준잔 1잔. 기본 기준 fastPerHour=2, window=60분.
const ev = (minsAgo: number, n = 1, type = '소주'): DrinkEvent => ({ t: T - minsAgo * MIN, n, type, unit: '잔' });

const call = (drinkEvents: DrinkEvent[], over = {}) =>
  drinkingPace({ drinkEvents, unit: '잔', drinkType: '소주', now: T, ...over });

describe('drinkingPace', () => {
  it('이벤트 없으면 fast=false, minsSinceLast=null, std=0', () => {
    const p = call([]);
    expect(p.fast).toBe(false);
    expect(p.minsSinceLast).toBeNull();
    expect(p.stdLastHour).toBe(0);
  });

  it('최근 40분간 소주 3잔 → 시간당 3표준잔, 빠름', () => {
    const p = call([ev(40), ev(20), ev(5)]);
    expect(p.stdLastHour).toBeCloseTo(3);
    expect(p.minsSinceLast).toBe(5);
    expect(p.fast).toBe(true);
  });

  it('창 안에 1잔뿐이면(나머지는 창 밖) 페이스 판단 안 함(fast=false)', () => {
    const p = call([ev(90), ev(5)]);
    expect(p.minsSinceLast).toBe(5);
    expect(p.fast).toBe(false); // recentCount < 2
  });

  it('저도수(청하) 2잔은 표준잔 환산이 낮아 빠름 아님', () => {
    const p = call([ev(30, 1, '청하'), ev(10, 1, '청하')]); // 5g*2/8 = 1.25 std
    expect(p.stdLastHour).toBeCloseTo(1.25);
    expect(p.fast).toBe(false);
  });

  it('마지막 잔이 창 밖(오래 전)이면 빠름 아님', () => {
    const p = call([ev(120), ev(90)]);
    expect(p.fast).toBe(false);
    expect(p.minsSinceLast).toBe(90);
  });

  it('기준(fastPerHour)을 낮추면 더 민감해진다', () => {
    const events = [ev(50, 1, '청하'), ev(10, 1, '청하')]; // 1.25 std/h
    expect(call(events).fast).toBe(false);
    expect(call(events, { fastPerHour: 1 }).fast).toBe(true);
  });
});

import {
  effectiveBrakePercents,
  brakeCountsFor,
  isBrakeAt,
  crossesBrake,
} from '../src/brake';

describe('effectiveBrakePercents', () => {
  it('강화 off면 그대로', () => {
    expect(effectiveBrakePercents([60, 80], false)).toEqual([60, 80]);
  });
  it('강화 on이면 10%p 낮추되 최소 20', () => {
    expect(effectiveBrakePercents([60, 80], true)).toEqual([50, 70]);
    expect(effectiveBrakePercents([10, 25], true)).toEqual([20, 20]);
  });
});

describe('brakeCountsFor', () => {
  it('퍼센트를 잔수로 올림 환산', () => {
    expect(brakeCountsFor(5, [60, 80])).toEqual([3, 4]); // ceil(3.0)=3, ceil(4.0)=4
    expect(brakeCountsFor(7, [60, 80])).toEqual([5, 6]); // ceil(4.2)=5, ceil(5.6)=6
  });
  it('limit 0이면 0', () => {
    expect(brakeCountsFor(0, [60, 80])).toEqual([0, 0]);
  });
});

describe('isBrakeAt', () => {
  const base = { limit: 5, brakeCounts: [3, 4], repeatEveryDrinks: 3 };
  it('고정 임계 지점', () => {
    expect(isBrakeAt({ n: 3, ...base })).toBe(true);
    expect(isBrakeAt({ n: 4, ...base })).toBe(true);
    expect(isBrakeAt({ n: 2, ...base })).toBe(false);
  });
  it('한계 초과 후 N잔마다', () => {
    expect(isBrakeAt({ n: 5, ...base })).toBe(true); // 한계 도달
    expect(isBrakeAt({ n: 6, ...base })).toBe(false);
    expect(isBrakeAt({ n: 8, ...base })).toBe(true); // 5 + 3
  });
  it('limit<=0이면 항상 false', () => {
    expect(isBrakeAt({ n: 3, limit: 0, brakeCounts: [0, 0], repeatEveryDrinks: 3 })).toBe(false);
  });
});

describe('crossesBrake', () => {
  const base = { limit: 5, brakeCounts: [3, 4], repeatEveryDrinks: 3 };
  it('한 잔 추가가 지점을 밟으면 true', () => {
    expect(crossesBrake({ prev: 2, next: 3, ...base })).toBe(true);
  });
  it('지점을 안 밟으면 false', () => {
    expect(crossesBrake({ prev: 0, next: 2, ...base })).toBe(false);
    expect(crossesBrake({ prev: 5, next: 6, ...base })).toBe(false);
  });
  it('여러 잔(병)을 한 번에 더해도 구간 내 지점이 있으면 true', () => {
    expect(crossesBrake({ prev: 5, next: 8, ...base })).toBe(true); // 8잔째가 지점
    expect(crossesBrake({ prev: 1, next: 4, ...base })).toBe(true); // 3,4잔째
  });

  it('반잔(0.5) 스텝: 정수 지점을 새로 밟을 때만 true', () => {
    expect(crossesBrake({ prev: 2.5, next: 3, ...base })).toBe(true); // 3을 밟음
    expect(crossesBrake({ prev: 3, next: 3.5, ...base })).toBe(false); // 새 정수 없음
    expect(crossesBrake({ prev: 2, next: 2.5, ...base })).toBe(false); // 아직 3 안 됨
    expect(crossesBrake({ prev: 3.5, next: 4, ...base })).toBe(true); // 4를 밟음
    expect(crossesBrake({ prev: 4.5, next: 5, ...base })).toBe(true); // 한계 5 도달
  });
});

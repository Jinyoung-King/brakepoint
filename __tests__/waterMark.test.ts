import { crossesWaterMark } from '../src/waterMark';

describe('crossesWaterMark (물 알림 발동 판정)', () => {
  it('every=0이면 항상 안 뜸(끔)', () => {
    expect(crossesWaterMark(2, 3, 0)).toBe(false);
  });

  it('every 배수를 새로 넘을 때만 true', () => {
    expect(crossesWaterMark(2, 3, 3)).toBe(true); // 3 도달
    expect(crossesWaterMark(3, 4, 3)).toBe(false); // 배수 안 넘음
    expect(crossesWaterMark(5, 6, 3)).toBe(true); // 6 도달
  });

  it('한 번에 여러 잔 늘어도 배수를 넘었으면 true', () => {
    expect(crossesWaterMark(2, 5, 3)).toBe(true); // 2→5, 3 넘음
  });

  it('startAt 이하에선 안 뜸(초반 스킵)', () => {
    // startAt=7: 3·6에서 안 뜨고, 7 넘은 뒤 첫 배수(9)에서 뜸
    expect(crossesWaterMark(2, 3, 3, 7)).toBe(false);
    expect(crossesWaterMark(5, 6, 3, 7)).toBe(false);
    expect(crossesWaterMark(6, 7, 3, 7)).toBe(false); // next=7, startAt 이하
    expect(crossesWaterMark(8, 9, 3, 7)).toBe(true); // next=9 > 7
  });

  it('startAt=0이면 처음부터 정상 동작', () => {
    expect(crossesWaterMark(2, 3, 3, 0)).toBe(true);
  });
});

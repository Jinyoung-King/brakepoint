import { safeReturnMapLink, buildSafeReturnMessage } from '../src/share';

const coords = { lat: 37.5665, lng: 126.978 };

describe('safeReturnMapLink', () => {
  it('좌표를 보편 지도 링크로 만든다', () => {
    expect(safeReturnMapLink(coords)).toBe('https://maps.google.com/?q=37.5665,126.978');
  });
});

describe('buildSafeReturnMessage', () => {
  it('목적지가 있으면 방향을 포함한다', () => {
    const msg = buildSafeReturnMessage(coords, '서울 은평구 통일로');
    expect(msg).toContain('서울 은평구 통일로 방향으로 귀가 시작');
    expect(msg).toContain('https://maps.google.com/?q=37.5665,126.978');
    expect(msg).toContain('브레이크포인트');
  });

  it('목적지가 없거나 공백이면 기본 문구', () => {
    expect(buildSafeReturnMessage(coords)).toContain('지금 귀가 시작할게.');
    expect(buildSafeReturnMessage(coords, '   ')).toContain('지금 귀가 시작할게.');
    expect(buildSafeReturnMessage(coords, '   ')).not.toContain('방향으로');
  });
});

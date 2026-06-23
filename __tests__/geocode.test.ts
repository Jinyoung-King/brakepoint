import { geocodeAddress } from '../src/geocode';

const mockFetch = (impl: () => Promise<any>) => {
  (global as any).fetch = jest.fn(impl);
};

const okResponse = (body: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('geocodeAddress', () => {
  it('빈 문자열이면 네트워크 호출 없이 empty', async () => {
    mockFetch(async () => okResponse([]));
    const r = await geocodeAddress('   ');
    expect(r).toEqual({ ok: false, reason: 'empty' });
    expect((global as any).fetch).not.toHaveBeenCalled();
  });

  it('결과가 있으면 ok + 좌표(parseFloat)', async () => {
    mockFetch(async () => okResponse([{ lat: '37.5', lon: '127.0' }]));
    const r = await geocodeAddress('서울 강남');
    expect(r).toEqual({ ok: true, lat: 37.5, lng: 127.0 });
  });

  it('결과가 빈 배열이면 not-found', async () => {
    mockFetch(async () => okResponse([]));
    expect(await geocodeAddress('없는주소')).toEqual({ ok: false, reason: 'not-found' });
  });

  it('429면 rate-limited', async () => {
    mockFetch(async () => okResponse(null, 429));
    expect(await geocodeAddress('서울')).toEqual({ ok: false, reason: 'rate-limited' });
  });

  it('그 외 비정상 응답(500)은 error', async () => {
    mockFetch(async () => okResponse(null, 500));
    expect(await geocodeAddress('서울')).toEqual({ ok: false, reason: 'error' });
  });

  it('fetch가 던지면(네트워크/타임아웃) network', async () => {
    mockFetch(async () => {
      throw new Error('Network request failed');
    });
    expect(await geocodeAddress('서울')).toEqual({ ok: false, reason: 'network' });
  });

  it('좌표가 숫자가 아니면 not-found', async () => {
    mockFetch(async () => okResponse([{ lat: 'abc', lon: 'def' }]));
    expect(await geocodeAddress('서울')).toEqual({ ok: false, reason: 'not-found' });
  });
});

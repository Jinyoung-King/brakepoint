// 무료 지오코딩(OpenStreetMap Nominatim, API 키 불필요). 주소 → 좌표.
// 한국 주소 정확도는 들쭉날쭉할 수 있음.
// 실패 원인을 호출부에 노출해 사용자에게 맞는 안내를 띄울 수 있게 한다.

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'empty' | 'not-found' | 'rate-limited' | 'network' | 'error' };

const TIMEOUT_MS = 8000;

export async function geocodeAddress(query: string): Promise<GeocodeResult> {
  const q = query.trim();
  if (!q) return { ok: false, reason: 'empty' };

  // 응답이 없거나 느릴 때 무한 대기 방지
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(
      q
    )}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'brakepoint/1.0 (prototype)', 'Accept-Language': 'ko' },
      signal: controller.signal,
    });

    // Nominatim 사용량 정책: 과도한 호출 시 429. 그 외 비정상 응답은 error로.
    if (res.status === 429) return { ok: false, reason: 'rate-limited' };
    if (!res.ok) return { ok: false, reason: 'error' };

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { ok: true, lat, lng };
    }
    return { ok: false, reason: 'not-found' };
  } catch {
    // 타임아웃(abort)이나 네트워크 단절 모두 일시적 → 재시도 안내
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}

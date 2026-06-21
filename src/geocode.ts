// 무료 지오코딩(OpenStreetMap Nominatim, API 키 불필요). 주소 → 좌표.
// 한국 주소 정확도는 들쭉날쭉할 수 있음. 실패 시 null.
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=kr&q=${encodeURIComponent(
      q
    )}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'brakepoint/1.0 (prototype)', 'Accept-Language': 'ko' },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

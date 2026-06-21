import * as Location from 'expo-location';

// 현재 위치를 역지오코딩해서 사람이 읽을 주소 문자열로. 권한 거부/실패 시 null.
export async function getCurrentPlace(): Promise<string | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const arr = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    if (!arr.length) return null;
    const a = arr[0];
    const parts = [a.city || a.region, a.district, a.street || a.name].filter(Boolean) as string[];
    const place = Array.from(new Set(parts)).join(' ').trim();
    return place || null;
  } catch {
    return null;
  }
}

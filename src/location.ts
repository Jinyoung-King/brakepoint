import * as Location from 'expo-location';

import { confirmRationale } from './permissionRationale';

// 현재 위치를 역지오코딩해서 사람이 읽을 주소 문자열로. 권한 거부/실패 시 null.
export async function getCurrentPlace(): Promise<string | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted) {
      const ok = await confirmRationale(
        '위치 권한',
        '술자리 장소를 자동으로 채우고 집까지 길찾기를 열 때만 현재 위치를 써요. 위치를 따로 저장하거나 전송하지 않아요.'
      );
      if (!ok) return null;
    }
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

// 안심 귀가 공유용 현재 좌표. getCurrentPlace와 달리, 위치가 외부로 "전송"될 수
// 있음을 안내한다(자동 전송 아님 — 매번 공유시트에서 직접 선택). 실패 시 null.
export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (!current.granted) {
      const ok = await confirmRationale(
        '위치 권한',
        '‘안심 귀가 공유’를 누르면 현재 위치를 지도 링크로 만들어 네가 고른 사람에게 보낼 수 있어요. 자동 전송은 없고, 공유는 매번 직접 선택해요.'
      );
      if (!ok) return null;
    }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

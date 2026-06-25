// 안심 귀가 공유 메시지 빌더 (순수 함수, 네이티브 의존성 없음 → 테스트 가능).
// 좌표를 어떤 지도앱에서도 열리는 보편 링크로 만든다.
export function safeReturnMapLink(coords: { lat: number; lng: number }): string {
  return `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
}

export function buildSafeReturnMessage(coords: { lat: number; lng: number }, dest?: string): string {
  const d = dest?.trim();
  const head = d ? `지금 ${d} 방향으로 귀가 시작할게.` : '지금 귀가 시작할게.';
  return `${head}\n현재 위치: ${safeReturnMapLink(coords)}\n\n(브레이크포인트 안심 귀가 공유)`;
}

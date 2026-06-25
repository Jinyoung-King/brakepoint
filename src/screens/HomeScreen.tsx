import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';
import { useMorningSchedule } from '../calendar/useMorningSchedule';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { alcoholGrams, estimateBac, hoursUntil, fmtHours, bacCurve, DRIVE_LIMIT } from '../bac';
import BacChart from '../BacChart';
import { alcoholKcal, hangoverForecast, limitStreak, sessionsThisWeek } from '../stats';
import { cancelCheckin } from '../checkin';
import { geocodeAddress } from '../geocode';
import { getCurrentPlace, getCurrentCoords } from '../location';
import { buildSafeReturnMessage } from '../share';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const QUICK_GAP_MS = 15 * 60 * 1000; // 15분 이내 재섭취 = 빠름

const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 지오코딩 일시적 실패(레이트리밋/네트워크/서버) 안내. not-found/empty는 호출부에서 문맥별로 처리.
const geocodeTransientMsg = (reason: 'rate-limited' | 'network' | 'error' | string): string => {
  switch (reason) {
    case 'rate-limited':
      return '주소 조회가 잠시 제한됐어요. 잠깐 뒤 다시 시도해주세요.';
    case 'network':
      return '네트워크가 불안정해요. 연결을 확인하고 다시 시도해주세요.';
    case 'error':
      return '주소 조회 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.';
    default:
      return '';
  }
};

export default function HomeScreen({ navigation }: Props) {
  const { state, addDrink, undoDrink, addCig, endSession, setDrinkingMode, setHomeCoords, setHomeAddress } =
    useAppState();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // 헤더 우측: 기록 / 설정 아이콘
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerBtns}>
          <Pressable onPress={() => navigation.navigate('History')} hitSlop={10}>
            <Ionicons name="stats-chart" size={22} color={c.text} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <Ionicons name="settings-outline" size={22} color={c.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, c, styles]);

  const {
    limit,
    count,
    cigs,
    unit,
    bottleToGlasses,
    drinkingMode,
    brakePercents,
    repeatEveryDrinks,
    calendarSync,
    sex,
    weightKg,
    drinkType,
    homeAddress,
    sessionStartMs,
    lastDrinkMs,
    drinkEvents,
    history,
    weeklyGoalSessions,
    waterEvery,
    homeLat,
    homeLng,
    smokingEnabled,
  } = state;
  const [transitLoading, setTransitLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrInput, setAddrInput] = useState('');
  const [addrError, setAddrError] = useState('');
  const [bacOpen, setBacOpen] = useState(false);
  const [safeOpen, setSafeOpen] = useState(false);

  // 시간 기반 표시(BAC·잔 간격)를 1분마다 갱신
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();

  const morning = useMorningSchedule(calendarSync);
  const effPercents = morning ? brakePercents.map((p) => Math.max(20, p - 10)) : brakePercents;

  const pct = limit > 0 ? Math.min(count / limit, 1) : 0;
  const brakeCounts = effPercents.map((p) => Math.ceil((limit * p) / 100));
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : Infinity;
  const overLimit = limit > 0 && count >= limit;
  const inBrake = limit > 0 && count >= firstBrake;
  const active = drinkingMode || count > 0; // 음주 중일 때만 보조 카드 노출
  const streak = limitStreak(history); // 시작 전 카드용
  const weekCount = sessionsThisWeek(history);

  // BAC 추정
  const hoursSince = sessionStartMs ? (now - sessionStartMs) / 3600000 : 0;
  const grams = alcoholGrams(count, unit, drinkType);
  const bac = estimateBac({ grams, weightKg, sex, hoursSinceStart: hoursSince });
  const canDrive = bac < DRIVE_LIMIT;
  // BAC 시간곡선(잔별 순알코올 g 사용). now가 바뀔 때만 재계산.
  const bacPoints = useMemo(
    () =>
      bacCurve({
        events: drinkEvents.map((e) => ({ t: e.t, grams: alcoholGrams(e.n, unit, drinkType) })),
        weightKg,
        sex,
        nowMs: now,
      }),
    [drinkEvents, unit, drinkType, weightKg, sex, now]
  );
  const minsSinceLast = lastDrinkMs ? Math.floor((now - lastDrinkMs) / 60000) : null;

  const [endOpen, setEndOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [memo, setMemo] = useState('');
  const [cost, setCost] = useState('');
  const [placeLoading, setPlaceLoading] = useState(false);

  // 페이스 코치: 한계까지 남은 양 + 다음 잔 권장 시점(권장 간격 30분)
  const REC_INTERVAL = 30;
  const remaining = Math.max(0, limit - count);
  const nextDrinkMin = lastDrinkMs ? Math.max(0, REC_INTERVAL - (minsSinceLast ?? 0)) : 0;

  const fillPlace = async (alertOnFail: boolean) => {
    setPlaceLoading(true);
    const p = await getCurrentPlace();
    setPlaceLoading(false);
    if (p) setPlace(p);
    else if (alertOnFail)
      Alert.alert('위치를 못 가져왔어요', '위치 권한을 허용했는지 확인하거나 직접 입력해주세요.');
  };

  const fillAddrFromLocation = async () => {
    setTransitLoading(true);
    const p = await getCurrentPlace();
    setTransitLoading(false);
    if (p) {
      setAddrInput(p);
      setAddrError('');
    } else setAddrError('위치를 못 가져왔어요. 직접 입력해주세요.');
  };

  const brakeAt = (n: number) => {
    if (limit <= 0) return false;
    const hitFixed = brakeCounts.includes(n);
    const repeat = n >= limit && (n - limit) % Math.max(1, repeatEveryDrinks) === 0;
    return hitFixed || repeat;
  };

  // n잔 추가. 여러 잔을 한 번에 더해도(=병) 그 구간에 브레이크 지점이 있으면 게이트 발동.
  const onAdd = (n: number) => {
    const prev = count;
    const next = prev + n;
    const gap = lastDrinkMs ? now - lastDrinkMs : Infinity;
    addDrink(n);
    let crossed = false;
    for (let k = prev + 1; k <= next; k++) if (brakeAt(k)) { crossed = true; break; }
    if (crossed) {
      navigation.navigate('CognitiveGate');
      return;
    }
    // 물 알림: waterEvery 배수를 넘었으면
    if (waterEvery > 0 && Math.floor(prev / waterEvery) < Math.floor(next / waterEvery)) {
      Alert.alert('물 한 잔', '술 사이에 물 한 잔이면 다음날이 한결 나아요.');
      return;
    }
    if (n === 1 && gap < QUICK_GAP_MS)
      Alert.alert('천천히 마셔요', '방금 마셨어요. 한 잔 텀을 좀 더 두는 게 좋아요.');
  };

  const onArrivedHome = () => {
    cancelCheckin();
    Alert.alert('잘 들어갔어요', '귀가 체크인 알림을 껐어요.');
  };

  const onEndSession = () => {
    if (count <= 0 && cigs <= 0) {
      Alert.alert('기록할 게 없어요', '마신 양이 0이라 기록하지 않아요.');
      return;
    }
    setEndOpen(true);
    if (!place) fillPlace(false); // 현재 위치 자동 입력 (실패해도 조용히)
  };
  const confirmEnd = () => {
    const won = parseInt(cost.replace(/[^0-9]/g, ''), 10);
    endSession({ place, memo, cost: Number.isFinite(won) ? won : undefined });
    setPlace('');
    setMemo('');
    setCost('');
    setEndOpen(false);
  };

  // 앱 스킴 시도 → 실패 시 웹으로 폴백
  const openExternal = (appUrl: string, webUrl: string) => {
    Linking.openURL(appUrl).catch(() => Linking.openURL(webUrl).catch(() => {}));
  };
  const requireHome = () => {
    const q = homeAddress.trim();
    if (!q) Alert.alert('집 주소를 먼저 설정하세요', '설정 → 집 주소에 입력하면 길찾기가 열려요.');
    return q;
  };
  const openKakaoMap = () => {
    const q = requireHome();
    if (!q) return;
    openExternal(`kakaomap://search?q=${encodeURIComponent(q)}`, `https://map.kakao.com/?q=${encodeURIComponent(q)}`);
  };
  const openNaverMap = () => {
    const q = requireHome();
    if (!q) return;
    openExternal(
      `nmap://search?query=${encodeURIComponent(q)}&appname=kr.co.cruxdata.brakepoint`,
      `https://map.naver.com/p/search/${encodeURIComponent(q)}`
    );
  };
  const openTaxi = () => {
    openExternal('kakaot://', 'https://play.google.com/store/apps/details?id=com.kakao.taxi');
  };
  // 안심 귀가 공유: 현위치 좌표 → 지도 링크 메시지 → 시스템 공유시트(연락처 권한 불필요)
  const shareSafeReturn = async () => {
    setShareLoading(true);
    const coords = await getCurrentCoords();
    setShareLoading(false);
    if (!coords) {
      Alert.alert('위치를 가져오지 못했어요', '위치 권한을 허용하면 현재 위치를 공유할 수 있어요.');
      return;
    }
    try {
      await Share.share({ message: buildSafeReturnMessage(coords, homeAddress) });
    } catch {
      // 사용자가 공유 취소한 경우 등은 조용히 무시
    }
  };
  const launchNaverTransit = (lat: number, lng: number, q: string) => {
    const name = encodeURIComponent(q);
    openExternal(
      `nmap://route/public?dlat=${lat}&dlng=${lng}&dname=${name}&appname=kr.co.cruxdata.brakepoint`,
      `https://map.naver.com/p/search/${name}`
    );
  };

  // 원탭 대중교통: 집 좌표(없으면 지오코딩) → 네이버지도 대중교통 경로(현위치→집).
  // 주소가 없거나 못 찾으면 막지 말고 주소 입력 모달을 띄운다.
  const openTransit = async () => {
    const q = homeAddress.trim();
    if (!q) {
      setAddrInput('');
      setAddrError('');
      setAddrOpen(true);
      return;
    }
    if (homeLat != null && homeLng != null) {
      launchNaverTransit(homeLat, homeLng, q);
      return;
    }
    setTransitLoading(true);
    const r = await geocodeAddress(q);
    setTransitLoading(false);
    if (!r.ok) {
      setAddrInput(q);
      setAddrError(
        geocodeTransientMsg(r.reason) ||
          '이 주소를 못 찾았어요. 동·도로명·번지까지 더 정확히 입력해보세요.'
      );
      setAddrOpen(true);
      return;
    }
    setHomeCoords(r.lat, r.lng);
    launchNaverTransit(r.lat, r.lng, q);
  };

  // 주소 입력 모달에서 "이 주소로 길찾기"
  const submitAddr = async () => {
    const q = addrInput.trim();
    if (!q) {
      setAddrError('주소를 입력해주세요.');
      return;
    }
    setHomeAddress(q); // 저장 + 캐시 좌표 초기화
    setTransitLoading(true);
    const r = await geocodeAddress(q);
    setTransitLoading(false);
    if (!r.ok) {
      setAddrError(geocodeTransientMsg(r.reason) || '주소를 못 찾았어요. 예: 서울 은평구 통일로 〇〇〇');
      return;
    }
    setHomeCoords(r.lat, r.lng);
    setAddrOpen(false);
    launchNaverTransit(r.lat, r.lng, q);
  };

  // 진행률 바 아래 한 줄 상태: 음주 중이면 페이스, 아니면 브레이크 설정
  const statusText = !active
    ? `브레이크 ${effPercents.join('·')}% (${brakeCounts.join('·')}${unit})`
    : overLimit
      ? `한계 초과 — 이후 ${repeatEveryDrinks}${unit}마다 알람`
      : inBrake
        ? `브레이크 구간 · 한계까지 ${remaining}${unit}`
        : `한계까지 ${remaining}${unit}${
            nextDrinkMin > 0 ? ` · 다음 잔 ${nextDrinkMin}분 뒤` : ' · 지금 마셔도 OK'
          }`;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {morning && (
          <View style={styles.scheduleBanner}>
            <Ionicons name="calendar-outline" size={16} color={c.amber} />
            <Text style={styles.scheduleText}>
              내일 {fmtTime(morning.startMs)} {morning.title} — 오늘은 적당히! (브레이크 강화됨)
            </Text>
          </View>
        )}

        {/* 현재 잔수 */}
        <View style={styles.counterBlock}>
          <View style={styles.countRow}>
            <Text style={[styles.countBig, inBrake && styles.countOver]}>{count}</Text>
            <Text style={styles.countLimit}>
              {' '}
              / {limit}
              {unit}
            </Text>
          </View>
        </View>

        {/* 진행률 + 한 줄 상태 (페이스/브레이크 통합) */}
        <View style={styles.card}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }, inBrake && styles.fillOver]} />
            {effPercents.map((p) => (
              <View key={p} style={[styles.thresholdLine, { left: `${Math.min(p, 100)}%` }]} />
            ))}
          </View>
          <View style={styles.brakeRow}>
            {inBrake && <Ionicons name="warning" size={14} color={c.red} />}
            <Text style={[styles.brakeText, inBrake && styles.warnText]}>{statusText}</Text>
          </View>
        </View>

        {/* +1잔 / +1병 */}
        <View style={styles.addRow}>
          <Pressable style={styles.addBtn} onPress={() => onAdd(1)}>
            <Text style={styles.addBtnText}>+1{unit}</Text>
          </Pressable>
          {unit === '잔' && (
            <Pressable style={styles.bottleBtn} onPress={() => onAdd(bottleToGlasses)}>
              <Text style={styles.bottleBtnText}>+1병</Text>
              <Text style={styles.bottleSub}>={bottleToGlasses}잔</Text>
            </Pressable>
          )}
        </View>

        {/* 시작 전(0잔·음주모드 off) 상태: 빈 화면 대신 지표 + 다음에 나타날 것 안내 */}
        {!active && (
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>아직 시작 전이에요</Text>
            {(streak > 0 || weeklyGoalSessions > 0) && (
              <View style={styles.startStats}>
                {streak > 0 && (
                  <View style={styles.inlineRow}>
                    <Ionicons name="flame" size={15} color={c.amber} />
                    <Text style={styles.startStat}>한도 지킴 {streak}연속</Text>
                  </View>
                )}
                {weeklyGoalSessions > 0 && (
                  <Text style={styles.startStat}>
                    이번 주 {weekCount} / 목표 {weeklyGoalSessions}회
                  </Text>
                )}
              </View>
            )}
            <Text style={styles.startHint}>
              첫 잔을 누르면 페이스 · 혈중알코올 · 안전 귀가가 여기 표시돼요.
            </Text>
          </View>
        )}

        {/* 방금 추가 취소 (잘못 누른 경우) */}
        {state.drinkEvents.length > 0 && (
          <Pressable style={styles.undoBtn} onPress={undoDrink} hitSlop={6}>
            <Ionicons name="arrow-undo" size={14} color={c.textMuted} />
            <Text style={styles.undoText}>방금 추가 취소</Text>
          </Pressable>
        )}

        {/* 흡연 (음주 중 + 트래킹 켰을 때) */}
        {active && smokingEnabled && (
          <View style={styles.rowCard}>
            <View style={styles.inlineRow}>
              <MaterialCommunityIcons name="smoking" size={18} color={c.text} />
              <Text style={styles.cigText}>
                담배 {cigs}개비
                {count > 0 && cigs > 0 ? `  ·  잔당 ${(cigs / count).toFixed(1)}개비` : ''}
              </Text>
            </View>
            <Pressable style={styles.smallBtn} onPress={addCig}>
              <Text style={styles.smallBtnText}>+1</Text>
            </Pressable>
          </View>
        )}

        {/* BAC 한 줄 요약 (탭하면 펼침) */}
        {count > 0 && (
          <Pressable style={styles.bacSummary} onPress={() => setBacOpen((o) => !o)}>
            <View style={styles.inlineRow}>
              <Text style={styles.bacSummaryLabel}>혈중알코올</Text>
              <Text style={[styles.bacSummaryValue, { color: canDrive ? c.green : c.red }]}>
                {bac.toFixed(3)}%
              </Text>
            </View>
            <Ionicons name={bacOpen ? 'chevron-up' : 'chevron-forward'} size={16} color={c.textMuted} />
          </Pressable>
        )}
        {count > 0 && bacOpen && (
          <View style={styles.bacDetail}>
            {bacPoints.length >= 2 && (
              <BacChart points={bacPoints} nowMs={now} driveLimit={DRIVE_LIMIT} c={c} />
            )}
            {canDrive ? (
              <Text style={styles.muted}>
                운전 가능 추정 범위 · 완전 해독 {fmtHours(hoursUntil(bac, 0))} 뒤 (
                {fmtTime(now + hoursUntil(bac, 0) * 3600000)})
              </Text>
            ) : (
              <Text style={styles.muted}>
                운전 가능(0.03%↓) {fmtHours(hoursUntil(bac, DRIVE_LIMIT))} 뒤 ·{' '}
                {fmtTime(now + hoursUntil(bac, DRIVE_LIMIT) * 3600000)}
                {'\n'}완전 해독 {fmtHours(hoursUntil(bac, 0))} 뒤 ·{' '}
                {fmtTime(now + hoursUntil(bac, 0) * 3600000)}
              </Text>
            )}
            <View style={styles.inlineRow}>
              <Ionicons name="flame" size={14} color={c.textMuted} />
              <Text style={styles.muted}>
                약 {alcoholKcal(grams)}kcal · 숙취 위험 {hangoverForecast(bac).level}
              </Text>
            </View>
            <Text style={styles.disclaimer}>
              {hangoverForecast(bac).tip} · 추정치이니 운전 판단 근거로 쓰지 마세요.
            </Text>
          </View>
        )}

        {/* 음주모드 */}
        <View style={styles.rowCard}>
          <View style={styles.modeText}>
            <Text style={styles.modeTitle}>음주모드</Text>
            <Text style={styles.muted}>켜면 주기마다 가짜 전화가 와요</Text>
          </View>
          <Switch value={drinkingMode} onValueChange={setDrinkingMode} />
        </View>

        {/* 하단 액션: 안전 귀가 + 종료 (음주 중일 때만 — 0잔엔 종료할 게 없음) */}
        {active && (
          <View style={styles.footerRow}>
            <Pressable style={styles.safeMainBtn} onPress={() => setSafeOpen(true)}>
              <Ionicons name="home-outline" size={18} color="#fff" />
              <Text style={styles.safeMainBtnText}>안전 귀가</Text>
            </Pressable>
            <Pressable style={[styles.endBtn, styles.endBtnHalf]} onPress={onEndSession}>
              <Ionicons name="flag-outline" size={18} color={c.text} />
              <Text style={styles.endBtnText}>술자리 종료</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* 술자리 종료 모달 */}
      <Modal visible={endOpen} transparent animationType="fade" onRequestClose={() => setEndOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>술자리 종료</Text>
            <Text style={styles.muted}>
              {count}
              {unit} · 담배 {cigs}개비 · 기록에 저장해요
            </Text>
            <View style={styles.labelRow}>
              <Text style={styles.label}>장소 (선택)</Text>
              <Pressable style={styles.locBtn} onPress={() => fillPlace(true)} hitSlop={8}>
                <Ionicons name="location-outline" size={14} color={c.blue} />
                <Text style={styles.locBtnText}>{placeLoading ? '찾는 중…' : '현재 위치'}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={place}
              onChangeText={setPlace}
              placeholder="예: 연신내 물빛공원"
              placeholderTextColor={c.textFaint}
            />
            <Text style={styles.label}>메모 (선택)</Text>
            <TextInput
              style={styles.input}
              value={memo}
              onChangeText={setMemo}
              placeholder="예: 비둘기 타다끼 맛있었음"
              placeholderTextColor={c.textFaint}
            />
            <Text style={styles.label}>술값 (선택, 원)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={cost}
              onChangeText={setCost}
              placeholder="예: 35000"
              placeholderTextColor={c.textFaint}
            />
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setEndOpen(false)} hitSlop={8}>
                <Text style={styles.link}>취소</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={confirmEnd}>
                <Text style={styles.saveBtnText}>저장하고 종료</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 집 주소 입력 (대중교통 길찾기용) */}
      <Modal visible={addrOpen} transparent animationType="fade" onRequestClose={() => setAddrOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>집 주소 입력</Text>
            <Text style={styles.muted}>대중교통 길찾기에 쓸 집 주소예요. 정확히 입력할수록 좋아요.</Text>
            <View style={styles.labelRow}>
              <Text style={styles.label}>주소</Text>
              <Pressable style={styles.locBtn} onPress={fillAddrFromLocation} hitSlop={8}>
                <Ionicons name="location-outline" size={14} color={c.blue} />
                <Text style={styles.locBtnText}>{transitLoading ? '…' : '현재 위치'}</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={addrInput}
              onChangeText={(t) => {
                setAddrInput(t);
                setAddrError('');
              }}
              placeholder="예: 서울 은평구 통일로 123"
              placeholderTextColor={c.textFaint}
              autoFocus
            />
            {!!addrError && <Text style={styles.addrError}>{addrError}</Text>}
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setAddrOpen(false)} hitSlop={8}>
                <Text style={styles.link}>취소</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={submitAddr} disabled={transitLoading}>
                <Text style={styles.saveBtnText}>{transitLoading ? '확인 중…' : '이 주소로 길찾기'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 안전 귀가 시트 */}
      <Modal visible={safeOpen} transparent animationType="fade" onRequestClose={() => setSafeOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setSafeOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>안전 귀가</Text>
            <Pressable style={styles.transitBtn} onPress={openTransit} disabled={transitLoading}>
              <Ionicons name="bus" size={18} color="#fff" />
              <Text style={styles.transitBtnText}>
                {transitLoading ? '주소 찾는 중…' : '대중교통으로 집 가기'}
              </Text>
            </Pressable>
            <View style={styles.safeBtns}>
              <Pressable style={styles.safeBtn} onPress={openKakaoMap}>
                <Ionicons name="map-outline" size={16} color={c.text} />
                <Text style={styles.safeBtnText}>카카오맵</Text>
              </Pressable>
              <Pressable style={styles.safeBtn} onPress={openNaverMap}>
                <Ionicons name="map-outline" size={16} color={c.text} />
                <Text style={styles.safeBtnText}>네이버</Text>
              </Pressable>
              <Pressable style={styles.safeBtn} onPress={openTaxi}>
                <MaterialCommunityIcons name="taxi" size={16} color={c.text} />
                <Text style={styles.safeBtnText}>택시</Text>
              </Pressable>
            </View>
            <Pressable style={styles.shareBtn} onPress={shareSafeReturn} disabled={shareLoading}>
              <Ionicons name="share-social" size={16} color={c.text} />
              <Text style={styles.shareBtnText}>
                {shareLoading ? '위치 확인 중…' : '안심 귀가 공유'}
              </Text>
            </Pressable>
            <Pressable style={styles.arrivedBtn} onPress={onArrivedHome}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.arrivedBtnText}>집 도착했어요</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    container: { paddingHorizontal: 20, paddingTop: 16, alignItems: 'center', gap: 14 },
    scheduleBanner: { width: '100%', backgroundColor: c.amberBg, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
    scheduleText: { flex: 1, fontSize: 13, color: c.amber, fontWeight: '600' },
    brakeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    counterBlock: { alignItems: 'center', gap: 2, marginTop: 4 },
    countRow: { flexDirection: 'row', alignItems: 'baseline' },
    countBig: { fontSize: 72, fontWeight: '800', color: c.text },
    countOver: { color: c.red },
    countLimit: { fontSize: 24, fontWeight: '600', color: c.textFaint },
    muted: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    warnText: { color: c.red, fontWeight: '700' },
    card: { width: '100%', gap: 10 },
    track: { width: '100%', height: 22, backgroundColor: c.track, borderRadius: 11, overflow: 'hidden', position: 'relative' },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.blue, borderRadius: 11 },
    fillOver: { backgroundColor: c.red },
    thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: c.text, opacity: 0.55 },
    brakeText: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    startCard: { width: '100%', backgroundColor: c.card, borderRadius: radius.md, padding: 16, gap: 10, borderWidth: 1, borderColor: c.border },
    startTitle: { fontSize: 15, color: c.text, fontWeight: '700' },
    startStats: { gap: 6 },
    startStat: { fontSize: 14, color: c.textMuted },
    startHint: { fontSize: 13, color: c.textFaint, lineHeight: 19 },
    bacSummary: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border },
    bacSummaryLabel: { fontSize: 14, color: c.textMuted },
    bacSummaryValue: { fontSize: 16, fontWeight: '800' },
    bacDetail: { width: '100%', backgroundColor: c.cardAlt, borderRadius: radius.md, padding: 14, gap: 4, marginTop: -8 },
    disclaimer: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    addRow: { width: '100%', flexDirection: 'row', gap: 10 },
    addBtn: { flex: 2, backgroundColor: c.blue, paddingVertical: 18, borderRadius: radius.lg, alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 24, fontWeight: '800' },
    bottleBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 12, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    bottleBtnText: { color: c.text, fontSize: 18, fontWeight: '800' },
    bottleSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    undoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4 },
    undoText: { fontSize: 13, color: c.textMuted },
    rowCard: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border },
    cigText: { fontSize: 15, color: c.text },
    smallBtn: { backgroundColor: c.cardAlt, paddingVertical: 7, paddingHorizontal: 18, borderRadius: radius.sm },
    smallBtnText: { fontSize: 16, fontWeight: '700', color: c.text },
    modeText: { gap: 2 },
    modeTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    safeBtns: { flexDirection: 'row', gap: 10 },
    transitBtn: { backgroundColor: c.blue, paddingVertical: 13, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    transitBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
    safeBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 12, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    safeBtnText: { fontSize: 13, color: c.text, fontWeight: '600' },
    shareBtn: { backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.border, paddingVertical: 12, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    shareBtnText: { fontSize: 14, color: c.text, fontWeight: '600' },
    arrivedBtn: { backgroundColor: c.green, paddingVertical: 11, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    arrivedBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },
    headerBtns: { flexDirection: 'row', gap: 18, paddingRight: 4 },
    footerRow: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 4 },
    safeMainBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: radius.md, backgroundColor: c.blue },
    safeMainBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
    endBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
    endBtnHalf: { flex: 1, width: undefined },
    endBtnText: { fontSize: 15, color: c.text, fontWeight: '600' },
    link: { fontSize: 15, color: c.blue },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, gap: 10, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 19, fontWeight: '700', color: c.text },
    label: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    locBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    locBtnText: { fontSize: 13, color: c.blue, fontWeight: '600' },
    addrError: { fontSize: 13, color: c.red, marginTop: 2 },
    input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, color: c.text, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
    modalBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
    saveBtn: { backgroundColor: c.blue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.sm },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

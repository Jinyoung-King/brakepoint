import { useEffect, useMemo, useState } from 'react';
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
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

import type { RootStackParamList } from '../navigation/RootNavigator';
import type { MainTabParamList } from '../navigation/MainTabs';
import { useAppState } from '../state/AppStateContext';
import { useMorningSchedule } from '../calendar/useMorningSchedule';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { eventGrams, estimateBac, hoursUntil, fmtHours, bacCurve, DRIVE_LIMIT, STD_GRAMS, sessionStdCount } from '../bac';
import { effectiveBrakePercents, brakeCountsFor, crossesBrakeOnAdd } from '../brake';
import BacChart from '../BacChart';
import GaugeBar from '../GaugeBar';
import TipsyFace from '../TipsyFace';
import { isLoaded as isFontLoaded } from 'expo-font';
import { PIXEL_FONT } from '../fonts';
import type { GaugeStyle, SessionRecord } from '../storage';
import { DRINK_TYPES, WEEKDAYS } from '../constants';
import { alcoholKcal, hangoverForecast, limitStreak, sessionsThisWeek, weekdayRisk } from '../stats';
import { cancelCheckin } from '../checkin';
import { geocodeAddress } from '../geocode';
import { getCurrentPlace, getCurrentCoords } from '../location';
import { buildSafeReturnMessage } from '../share';
import MorningCheckSheet from '../MorningCheckSheet';
import { openFullScreenIntentSettings } from '../fakeCall/notifications';
import { canUseFullScreenIntent } from '../../modules/fsi-permission';
import { addHaptic, tapHaptic } from '../haptics';
import { notifyWater } from '../water';
import { crossesWaterMark } from '../waterMark';

// 게이지 바 탭 시 순환 순서 + 표시 이름
const GAUGE_CYCLE: GaugeStyle[] = ['classic', 'hp', 'hearts', 'boss', 'mp', 'tacho', 'protoss'];
const GAUGE_LABEL: Record<GaugeStyle, string> = {
  classic: '기본',
  hp: 'HP',
  hearts: '하트',
  boss: '보스',
  mp: 'MP',
  tacho: '타코미터',
  protoss: '프로토스',
};

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

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
  const { state, addDrink, undoDrink, addCig, addWater, endSession, setDrinkingMode, setHomeCoords, setHomeAddress, setPendingEnd, setGaugeStyle, setDrinkType, setMorningLog, setPendingMorningCheck } =
    useAppState();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // 대시보드/설정 진입은 하단 글라스 알약(navPill)으로 이동했다.

  const {
    limit,
    count,
    cigs,
    unit,
    drinkingMode,
    brakePercents,
    repeatEveryDrinks,
    calendarSync,
    sex,
    weightKg,
    drinkType,
    customDrinks,
    homeAddress,
    sessionStartMs,
    lastDrinkMs,
    drinkEvents,
    history,
    weeklyGoalSessions,
    waterEvery,
    waterStartAt,
    homeLat,
    homeLng,
    smokingEnabled,
    gaugeStyle,
    water,
    tipsyFaceEnabled,
  } = state;
  const [transitLoading, setTransitLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrInput, setAddrInput] = useState('');
  const [addrError, setAddrError] = useState('');
  const [bacOpen, setBacOpen] = useState(false);
  const [safeOpen, setSafeOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [morningTarget, setMorningTarget] = useState<SessionRecord | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);

  // 시간 기반 표시(BAC·잔 간격)를 1분마다 갱신
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const now = Date.now();

  const morning = useMorningSchedule(calendarSync);
  const effPercents = effectiveBrakePercents(brakePercents, !!morning);

  // 소비한 순알코올(g) → 표준잔(소주 1잔=8g) 환산. 한도/브레이크/게이지는 잔 개수가 아니라
  // 이 표준잔으로 판정한다(청하 1잔=0.6표준잔처럼 도수 차이가 정확히 반영됨). limit은 표준잔 단위.
  const stdCount = sessionStdCount(drinkEvents, count, unit, drinkType, customDrinks); // 표준잔 환산 누적 (위젯과 공용)
  const consumedGrams = stdCount * STD_GRAMS; // BAC 추정용 순알코올(g)
  const pct = limit > 0 ? Math.min(stdCount / limit, 1) : 0;
  const brakeCounts = brakeCountsFor(limit, effPercents);
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : Infinity;
  const overLimit = limit > 0 && stdCount >= limit;
  const inBrake = limit > 0 && stdCount >= firstBrake;
  const active = drinkingMode || count > 0; // 음주 중일 때만 보조 카드 노출
  // 브레이크 예고: 한 잔 더 마시면 브레이크(게이트)가 걸리는지 미리 판정 → 코칭 힌트.
  const nextBrakeSoon =
    active &&
    !overLimit &&
    crossesBrakeOnAdd({ drinkEvents, unit, drinkType, addN: 1, limit, brakePercents, repeatEveryDrinks, morningTighten: !!morning, customDrinks });
  const streak = limitStreak(history); // 시작 전 카드용
  const weekCount = sessionsThisWeek(history);
  // 위험 요일: 평소 오늘 요일에 더 많이 마셨으면 경고 배너
  const todayDow = new Date().getDay();
  const dowRisk = weekdayRisk(history, todayDow);
  // 시작 전 브리핑용 지표
  const lastEnd = history.length ? history[0].endedAt : null;
  const daysSinceLast = lastEnd != null ? Math.floor((now - lastEnd) / 86400000) : null;
  const daysSinceLabel =
    daysSinceLast == null ? '기록 없음' : daysSinceLast === 0 ? '오늘' : daysSinceLast === 1 ? '어제' : `${daysSinceLast}일 전`;
  const monthCount = history.filter((r) => {
    const d = new Date(r.endedAt);
    const t = new Date(now);
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth();
  }).length;

  // 음주모드 ON 시, 잠금화면 위 통화 권한(전체 화면 알림)이 막혀 있으면 안내
  const toggleDrinkingMode = (on: boolean) => {
    setDrinkingMode(on);
    if (on && !canUseFullScreenIntent()) {
      Alert.alert(
        '전체 화면 알림이 꺼져 있어요',
        '이게 꺼져 있으면 잠금화면에서 가짜 전화가 진동만 울리고 화면이 안 떠요. 지금 켜둘까요?\n\n삼성은 추가로:\n· 설정 → 앱 → 브레이크포인트 → 알림 → "전체 화면 알림 표시" ON\n· 배터리 → "제한 없음"',
        [
          { text: '나중에', style: 'cancel' },
          { text: '설정 열기', onPress: openFullScreenIntentSettings },
        ]
      );
    }
  };

  // BAC 추정 — 위에서 합산한 순알코올(consumedGrams) 사용(섞어 마셔도 정확).
  const hoursSince = sessionStartMs ? (now - sessionStartMs) / 3600000 : 0;
  const grams = consumedGrams;
  const bac = estimateBac({ grams, weightKg, sex, hoursSinceStart: hoursSince });
  const canDrive = bac < DRIVE_LIMIT;
  // 잔당 물 0.5잔 이상이면 "충분히 마심"으로 보고 숙취 위험 한 단계 완화
  const hydrated = count > 0 && water >= count * 0.5;
  const hangover = hangoverForecast(bac, hydrated);
  // BAC 시간곡선(잔별 순알코올 g 사용). now가 바뀔 때만 재계산.
  const bacPoints = useMemo(
    () =>
      bacCurve({
        events: drinkEvents.map((e) => ({ t: e.t, grams: eventGrams(e, unit, drinkType, customDrinks) })),
        weightKg,
        sex,
        nowMs: now,
      }),
    [drinkEvents, unit, drinkType, customDrinks, weightKg, sex, now]
  );
  // 이번 술자리 주종별 잔수 합계 (섞어 마셨을 때 분해 표시용)
  const mixByType = useMemo(() => {
    const m: Partial<Record<typeof drinkType, number>> = {};
    for (const e of drinkEvents) {
      const t = e.type ?? drinkType;
      m[t] = (m[t] ?? 0) + e.n;
    }
    return Object.entries(m).filter(([, n]) => (n ?? 0) > 0);
  }, [drinkEvents, drinkType]);
  const minsSinceLast = lastDrinkMs ? Math.floor((now - lastDrinkMs) / 60000) : null;

  const [endOpen, setEndOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [memo, setMemo] = useState('');
  const [cost, setCost] = useState('');
  const [placeLoading, setPlaceLoading] = useState(false);

  // 페이스 코치: 한계까지 남은 양 + 다음 잔 권장 시점(권장 간격 30분)
  const REC_INTERVAL = 30;
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

  // n잔 추가. 여러 잔을 한 번에 더해도(=병) 그 구간에 브레이크 지점이 있으면 게이트 발동.
  const onAdd = (n: number) => {
    addHaptic();
    const prev = count;
    const next = prev + n;
    const gap = lastDrinkMs ? now - lastDrinkMs : Infinity;
    addDrink(n);
    // 브레이크는 표준잔(순알코올) 기준 — 지금 마시는 주종의 알코올량만큼만 차오른다.
    if (crossesBrakeOnAdd({ drinkEvents, unit, drinkType, addN: n, limit, brakePercents, repeatEveryDrinks, morningTighten: !!morning, customDrinks })) {
      navigation.navigate('CognitiveGate');
      return;
    }
    // 물 알림: waterEvery 배수를 넘으면 헤드업 알림 (초반 waterStartAt까지는 스킵, 비블로킹)
    if (crossesWaterMark(prev, next, waterEvery, waterStartAt)) {
      notifyWater();
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

  // 상시 알림의 "종료" 액션으로 앱이 열린 경우(pendingEnd): 평소 종료 흐름과 동일하게 모달을 연다.
  useEffect(() => {
    if (!state.pendingEnd) return;
    setPendingEnd(false);
    onEndSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingEnd]);

  // 아침 컨디션 알림 탭으로 복귀(pendingMorningCheck): 최근 24h 내 아직 기록 안 된 술자리를 찾아 시트를 연다.
  useEffect(() => {
    if (!state.pendingMorningCheck) return;
    setPendingMorningCheck(false);
    const cutoff = Date.now() - 24 * 3600_000;
    const target = state.history.find((r) => r.endedAt >= cutoff && !r.morning) ?? null;
    setMorningTarget(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pendingMorningCheck]);

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
  // 주변 화장실: 네이버 지도에서 현재 위치 기준 "화장실" 검색 (앱→웹 폴백)
  const openRestroom = () => {
    openExternal(
      'nmap://search?query=화장실&appname=kr.co.cruxdata.brakepoint',
      'https://map.naver.com/p/search/화장실'
    );
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

  // 취기 = 순알코올(표준잔) 기준 주량 대비 %. 잔 개수가 아니라 마신 알코올량 기준.
  const tipsy = Math.round(pct * 100);
  // 진행률 바 아래 한 줄 상태: 음주 중이면 취기%, 아니면 브레이크 설정
  const statusText = !active
    ? `브레이크 ${effPercents.join('·')}%`
    : overLimit
      ? '한계 초과 — 천천히, 물 한 잔'
      : nextBrakeSoon
        ? `취기 ${tipsy}% · 한 잔 더면 브레이크`
        : inBrake
          ? `브레이크 구간 · 취기 ${tipsy}%`
          : `취기 ${tipsy}%${nextDrinkMin > 0 ? ` · 다음 잔 ${nextDrinkMin}분 뒤` : ' · 지금 마셔도 OK'}`;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 96 }]}>
        {dowRisk.risky && !active && (
          <View style={styles.scheduleBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={c.amber} />
            <Text style={styles.scheduleText}>
              오늘 {WEEKDAYS[todayDow]}요일 — 평소 이 요일엔 평균 {dowRisk.dowAvg.toFixed(1)}{unit}(전체{' '}
              {dowRisk.allAvg.toFixed(1)}{unit})으로 많이 마셔요. 천천히 가요.
            </Text>
          </View>
        )}
        {morning && (
          <View style={styles.scheduleBanner}>
            <Ionicons name="calendar-outline" size={16} color={c.amber} />
            <Text style={styles.scheduleText}>
              내일 {fmtTime(morning.startMs)} {morning.title} — 오늘은 적당히! (브레이크 강화됨)
            </Text>
          </View>
        )}

        {/* 취기 캐릭터 (음주 중, 설정 켰을 때) */}
        {active && tipsyFaceEnabled && (
          <View style={styles.faceWrap}>
            <TipsyFace pct={pct} overLimit={overLimit} c={c} />
          </View>
        )}

        {/* 현재 잔수 */}
        <View style={styles.counterBlock}>
          <View style={styles.countRow}>
            <Text
              style={[
                styles.countBig,
                inBrake && styles.countOver,
                gaugeStyle !== 'classic' && isFontLoaded(PIXEL_FONT) && styles.countPixel,
              ]}
            >
              {count}
            </Text>
            <Text style={styles.countLimit}>
              {' '}
              {unit} · 취기 {tipsy}%
            </Text>
          </View>
        </View>

        {/* 진행률 + 한 줄 상태 (페이스/브레이크 통합) */}
        <Pressable style={styles.card} onPress={() => { tapHaptic(); setStyleOpen(true); }} hitSlop={6}>
          <GaugeBar
            style={gaugeStyle}
            count={stdCount}
            limit={limit}
            pct={pct}
            effPercents={effPercents}
            brakeCounts={brakeCounts}
            inBrake={inBrake}
            overLimit={overLimit}
            c={c}
          />
          <View style={styles.gaugeHint}>
            <Ionicons name="color-palette-outline" size={12} color={c.textFaint} />
            <Text style={styles.gaugeHintText}>{GAUGE_LABEL[gaugeStyle]} · 탭해서 변경</Text>
          </View>
          <View style={styles.brakeRow}>
            {inBrake && <Ionicons name="warning" size={14} color={c.red} />}
            <Text style={[styles.brakeText, inBrake && styles.warnText]}>{statusText}</Text>
          </View>
        </Pressable>

        {/* 지금 마시는 술 (섞어 마실 때 잔마다 주종 기록) */}
        <View style={styles.typeRow}>
          {[...DRINK_TYPES, ...customDrinks.map((cd) => cd.name)].map((t) => {
            const on = t === drinkType;
            return (
              <Pressable
                key={t}
                style={[styles.typeChip, on && styles.typeChipActive]}
                onPress={() => { tapHaptic(); setDrinkType(t); }}
              >
                <Text style={[styles.typeChipText, on && styles.typeChipTextActive]}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 브레이크 예고 코칭 (다음 잔이 게이트일 때) */}
        {nextBrakeSoon && (
          <View style={styles.brakeHint}>
            <Ionicons name="water-outline" size={16} color={c.blue} />
            <Text style={styles.brakeHintText}>한 잔 더 마시면 브레이크가 걸려요. 물 한 잔 먼저 어때요?</Text>
          </View>
        )}
        {/* +1잔 / +1병 */}
        <View style={styles.addRow}>
          <Pressable
            style={styles.addBtn}
            onPress={() => onAdd(1)}
            accessibilityRole="button"
            accessibilityLabel={`한 ${unit} 추가`}
          >
            <Text style={styles.addBtnText}>+1{unit}</Text>
          </Pressable>
        </View>
        {unit === '잔' && (
          <View style={styles.fracRow}>
            <Pressable style={styles.fracBtn} onPress={() => onAdd(0.25)}>
              <Text style={styles.bottleBtnText}>+¼</Text>
              <Text style={styles.bottleSub}>0.25잔</Text>
            </Pressable>
            <Pressable style={styles.fracBtn} onPress={() => onAdd(0.5)}>
              <Text style={styles.bottleBtnText}>+½</Text>
              <Text style={styles.bottleSub}>반잔</Text>
            </Pressable>
          </View>
        )}

        {/* 시작 전(0잔·음주모드 off) 상태: 빈 화면 대신 지표 + 다음에 나타날 것 안내 */}
        {!active && (
          <Pressable style={styles.startCard} onPress={() => { tapHaptic(); setBriefOpen(true); }}>
            <View style={styles.startTitleRow}>
              <Text style={styles.startTitle}>아직 시작 전이에요</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
            </View>
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
              탭하면 오늘의 브리핑 · 첫 잔을 누르면 페이스·혈중알코올·안전 귀가가 표시돼요.
            </Text>
          </Pressable>
        )}

        {/* 방금 추가 취소 (잘못 누른 경우) */}
        {state.drinkEvents.length > 0 && (
          <Pressable style={styles.undoBtn} onPress={() => { tapHaptic(); undoDrink(); }} hitSlop={6}>
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
            <Pressable
              style={styles.smallBtn}
              onPress={() => { tapHaptic(); addCig(); }}
              accessibilityRole="button"
              accessibilityLabel="담배 한 개비 추가"
            >
              <Text style={styles.smallBtnText}>+1</Text>
            </Pressable>
          </View>
        )}

        {/* 물 (음주 중) — 잔 사이 물 기록 → 숙취 완화 */}
        {active && (
          <View style={styles.rowCard}>
            <View style={styles.inlineRow}>
              <Ionicons name="water" size={18} color={c.blue} />
              <Text style={styles.cigText}>
                물 {water}잔
                {count > 0 ? `  ·  잔당 ${(water / count).toFixed(1)}잔` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.smallBtn}
              onPress={() => { tapHaptic(); addWater(); }}
              accessibilityRole="button"
              accessibilityLabel="물 한 잔 추가"
            >
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
              <BacChart
                points={bacPoints}
                nowMs={now}
                driveLimit={DRIVE_LIMIT}
                c={c}
                eventTimes={drinkEvents.map((e) => e.t)}
              />
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
                약 {alcoholKcal(grams)}kcal · 숙취 위험 {hangover.level}
              </Text>
            </View>
            {mixByType.length > 1 && (
              <Text style={styles.muted}>
                {mixByType.map(([t, n]) => `${t} ${n}`).join(' · ')}
                {unit}
              </Text>
            )}
            <Text style={styles.disclaimer}>
              {hangover.tip} · 추정치이니 운전 판단 근거로 쓰지 마세요.
            </Text>
          </View>
        )}

        {/* 음주모드 */}
        <View style={styles.rowCard}>
          <View style={styles.modeText}>
            <Text style={styles.modeTitle}>음주모드</Text>
            <Text style={styles.muted}>켜면 주기마다 가짜 전화가 와요</Text>
          </View>
          <Switch value={drinkingMode} onValueChange={toggleDrinkingMode} />
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

      {/* 다음날 아침 컨디션 체크인 시트 */}
      <MorningCheckSheet
        record={morningTarget}
        onSave={(id, log) => {
          setMorningLog(id, log);
          setMorningTarget(null);
        }}
        onClose={() => setMorningTarget(null)}
      />

      {/* 술자리 종료 모달 */}
      <Modal visible={endOpen} transparent animationType="fade" onRequestClose={() => setEndOpen(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>술자리 종료</Text>
            <Text style={styles.muted}>
              {count}
              {unit} · 담배 {cigs}개비 · 물 {water}잔 · 기록에 저장해요
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
            <Pressable style={styles.shareBtn} onPress={openRestroom}>
              <MaterialCommunityIcons name="toilet" size={16} color={c.text} />
              <Text style={styles.shareBtnText}>주변 화장실 찾기</Text>
            </Pressable>
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

      {/* 오늘의 브리핑 (시작 전 카드 탭) */}
      <Modal visible={briefOpen} transparent animationType="fade" onRequestClose={() => setBriefOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setBriefOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>오늘의 브리핑</Text>
            {[
              { label: '마지막 음주', value: daysSinceLabel },
              { label: '이번 주', value: `${weekCount}회${weeklyGoalSessions > 0 ? ` / 목표 ${weeklyGoalSessions}` : ''}` },
              { label: '한도 지킴 연속', value: `${streak}회` },
              { label: '이번 달', value: `${monthCount}회` },
              { label: '내 한도', value: `소주 ${limit}잔` },
              { label: '내일 오전 일정', value: morning ? `${fmtTime(morning.startMs)} ${morning.title}` : '없음' },
            ].map((r) => (
              <View key={r.label} style={styles.briefRow}>
                <Text style={styles.muted}>{r.label}</Text>
                <Text style={styles.briefValue}>{r.value}</Text>
              </View>
            ))}
            <Text style={styles.briefTip}>
              {morning
                ? '내일 일정 있어요 — 오늘은 적당히.'
                : streak >= 3
                  ? `${streak}연속 한도 지킴 중 — 오늘도 가볍게.`
                  : '오늘도 페이스 조절해서 가요.'}
            </Text>
            <Pressable style={styles.briefClose} onPress={() => setBriefOpen(false)}>
              <Text style={styles.saveBtnText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 게이지 스타일 선택 (미리보기) */}
      <Modal visible={styleOpen} transparent animationType="fade" onRequestClose={() => setStyleOpen(false)}>
        <Pressable style={styles.modalBg} onPress={() => setStyleOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>게이지 스타일</Text>
            <ScrollView style={styles.styleScroll} contentContainerStyle={{ gap: 10 }}>
            {GAUGE_CYCLE.map((opt) => {
              const active = opt === gaugeStyle;
              return (
                <Pressable
                  key={opt}
                  style={[styles.styleRow, active && styles.styleRowActive]}
                  onPress={() => {
                    tapHaptic();
                    setGaugeStyle(opt);
                    setStyleOpen(false);
                  }}
                >
                  <View style={styles.styleRowTop}>
                    <Text style={[styles.styleName, active && styles.styleNameActive]}>
                      {GAUGE_LABEL[opt]}
                    </Text>
                    {active && <Ionicons name="checkmark-circle" size={18} color={c.blue} />}
                  </View>
                  <GaugeBar
                    style={opt}
                    count={1}
                    limit={5}
                    pct={0.5}
                    effPercents={[60, 80]}
                    brakeCounts={[3, 4]}
                    inBrake={false}
                    overLimit={false}
                    c={c}
                  />
                </Pressable>
              );
            })}
            </ScrollView>
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
    faceWrap: { alignItems: 'center', marginTop: 2 },
    counterBlock: { alignItems: 'center', gap: 2, marginTop: 4 },
    countRow: { flexDirection: 'row', alignItems: 'baseline' },
    countBig: { fontSize: 72, fontWeight: '800', color: c.text },
    countPixel: { fontFamily: PIXEL_FONT, fontSize: 48, fontWeight: '400' },
    countOver: { color: c.red },
    countLimit: { fontSize: 24, fontWeight: '600', color: c.textFaint },
    muted: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    warnText: { color: c.red, fontWeight: '700' },
    card: { width: '100%', gap: 10 },
    styleScroll: { width: '100%', maxHeight: 460 },
    styleRow: { width: '100%', gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: c.border },
    styleRowActive: { borderColor: c.blue, backgroundColor: c.cardAlt },
    styleRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    styleName: { fontSize: 15, fontWeight: '700', color: c.text },
    styleNameActive: { color: c.blue },
    gaugeHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: -4 },
    gaugeHintText: { fontSize: 11, color: c.textFaint },
    brakeText: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    startCard: { width: '100%', backgroundColor: c.card, borderRadius: radius.md, padding: 16, gap: 10, borderWidth: 1, borderColor: c.border },
    startTitle: { fontSize: 15, color: c.text, fontWeight: '700' },
    startTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    briefRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
    briefValue: { fontSize: 15, fontWeight: '700', color: c.text },
    briefTip: { fontSize: 13, color: c.amber, fontWeight: '600', marginTop: 6 },
    briefClose: { backgroundColor: c.blue, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center', marginTop: 6 },
    startStats: { gap: 6 },
    startStat: { fontSize: 14, color: c.textMuted },
    startHint: { fontSize: 13, color: c.textFaint, lineHeight: 19 },
    bacSummary: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: c.border },
    bacSummaryLabel: { fontSize: 14, color: c.textMuted },
    bacSummaryValue: { fontSize: 16, fontWeight: '800' },
    bacDetail: { width: '100%', backgroundColor: c.cardAlt, borderRadius: radius.md, padding: 14, gap: 4, marginTop: -8 },
    disclaimer: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    typeRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeChip: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    typeChipActive: { backgroundColor: c.blue, borderColor: c.blue },
    typeChipText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    typeChipTextActive: { color: '#fff' },
    brakeHint: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.cardAlt, borderWidth: 1, borderColor: c.blue, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 },
    brakeHintText: { flex: 1, fontSize: 13, color: c.text, fontWeight: '600' },
    addRow: { width: '100%', flexDirection: 'row', gap: 10 },
    addBtn: { flex: 2, backgroundColor: c.blue, paddingVertical: 18, borderRadius: radius.lg, alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 24, fontWeight: '800' },
    fracRow: { width: '100%', flexDirection: 'row', gap: 10 },
    fracBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 12, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
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

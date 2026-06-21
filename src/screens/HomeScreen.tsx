import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';
import { useMorningSchedule } from '../calendar/useMorningSchedule';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { alcoholGrams, estimateBac, hoursUntil, fmtHours, DRIVE_LIMIT } from '../bac';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const QUICK_GAP_MS = 15 * 60 * 1000; // 15분 이내 재섭취 = 빠름

const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function HomeScreen({ navigation }: Props) {
  const { state, addDrink, addCig, endSession, setDrinkingMode } = useAppState();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

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
    homeAddress,
    sessionStartMs,
    lastDrinkMs,
  } = state;

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

  // BAC 추정
  const hoursSince = sessionStartMs ? (now - sessionStartMs) / 3600000 : 0;
  const bac = estimateBac({ grams: alcoholGrams(count, unit), weightKg, sex, hoursSinceStart: hoursSince });
  const canDrive = bac < DRIVE_LIMIT;
  const minsSinceLast = lastDrinkMs ? Math.floor((now - lastDrinkMs) / 60000) : null;

  const [endOpen, setEndOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [memo, setMemo] = useState('');

  const brakeAt = (n: number) => {
    if (limit <= 0) return false;
    const hitFixed = brakeCounts.includes(n);
    const repeat = n >= limit && (n - limit) % Math.max(1, repeatEveryDrinks) === 0;
    return hitFixed || repeat;
  };

  // n잔 추가. 여러 잔을 한 번에 더해도(=병) 그 구간에 브레이크 지점이 있으면 게이트 발동.
  const onAdd = (n: number) => {
    const prev = count;
    const gap = lastDrinkMs ? now - lastDrinkMs : Infinity;
    addDrink(n);
    let crossed = false;
    for (let k = prev + 1; k <= prev + n; k++) if (brakeAt(k)) { crossed = true; break; }
    if (crossed) navigation.navigate('CognitiveGate');
    else if (n === 1 && gap < QUICK_GAP_MS)
      Alert.alert('천천히 마셔요', '방금 마셨어요. 한 잔 텀을 좀 더 두는 게 좋아요. 🐢');
  };

  const onEndSession = () => {
    if (count <= 0 && cigs <= 0) {
      Alert.alert('기록할 게 없어요', '마신 양이 0이라 기록하지 않아요.');
      return;
    }
    setEndOpen(true);
  };
  const confirmEnd = () => {
    endSession({ place, memo });
    setPlace('');
    setMemo('');
    setEndOpen(false);
  };

  const openDirections = () => {
    const q = homeAddress.trim();
    if (!q) {
      Alert.alert('집 주소를 먼저 설정하세요', '설정 → 집 주소에 입력하면 길찾기가 열려요.');
      return;
    }
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`);
  };
  const openTaxi = () => {
    Linking.openURL('kakaot://').catch(() =>
      Linking.openURL('https://play.google.com/store/apps/details?id=com.kakao.taxi')
    );
  };

  const brakeText = overLimit
    ? `⚠️ 한계 초과 — 이후 ${repeatEveryDrinks}${unit}마다 알람`
    : inBrake
      ? '⚠️ 브레이크 구간'
      : `브레이크 ${effPercents.join('·')}% (${brakeCounts.join('·')}${unit})`;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
        {morning && (
          <View style={styles.scheduleBanner}>
            <Text style={styles.scheduleText}>
              📅 내일 {fmtTime(morning.startMs)} {morning.title} — 오늘은 적당히! (브레이크 강화됨)
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
          <Text style={styles.muted}>
            오늘 마신 {unit}
            {minsSinceLast !== null ? ` · 마지막 잔 ${minsSinceLast}분 전` : ''}
          </Text>
        </View>

        {/* 진행률 카드 (브레이크 지점마다 선) */}
        <View style={styles.card}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${pct * 100}%` }, inBrake && styles.fillOver]} />
            {effPercents.map((p) => (
              <View key={p} style={[styles.thresholdLine, { left: `${Math.min(p, 100)}%` }]} />
            ))}
          </View>
          <Text style={[styles.brakeText, inBrake && styles.warnText]}>{brakeText}</Text>
        </View>

        {/* BAC 추정 */}
        {count > 0 && (
          <View style={styles.bacCard}>
            <View style={styles.bacRow}>
              <Text style={styles.bacLabel}>추정 혈중알코올</Text>
              <Text style={[styles.bacValue, { color: canDrive ? c.green : c.red }]}>
                {bac.toFixed(3)}%
              </Text>
            </View>
            <Text style={styles.muted}>
              {canDrive
                ? '운전 가능 추정 범위'
                : `운전 가능(0.03% 미만)까지 약 ${fmtHours(hoursUntil(bac, DRIVE_LIMIT))}`}
              {' · 완전 해독 '}
              {fmtHours(hoursUntil(bac, 0))}
            </Text>
            <Text style={styles.disclaimer}>※ 추정치예요. 실제와 다를 수 있으니 운전 판단 근거로 쓰지 마세요.</Text>
          </View>
        )}

        {/* +1잔 / +1병 */}
        <View style={styles.addRow}>
          <Pressable style={styles.addBtn} onPress={() => onAdd(1)}>
            <Text style={styles.addBtnText}>+1{unit}</Text>
          </Pressable>
          <Pressable style={styles.bottleBtn} onPress={() => onAdd(bottleToGlasses)}>
            <Text style={styles.bottleBtnText}>+1병</Text>
            <Text style={styles.bottleSub}>={bottleToGlasses}{unit}</Text>
          </Pressable>
        </View>

        {/* 흡연 */}
        <View style={styles.rowCard}>
          <Text style={styles.cigText}>🚬 담배 {cigs}개비</Text>
          <Pressable style={styles.smallBtn} onPress={addCig}>
            <Text style={styles.smallBtnText}>+1</Text>
          </Pressable>
        </View>

        {/* 음주모드 */}
        <View style={styles.rowCard}>
          <View style={styles.modeText}>
            <Text style={styles.modeTitle}>음주모드</Text>
            <Text style={styles.muted}>켜면 주기마다 가짜 전화가 와요</Text>
          </View>
          <Switch value={drinkingMode} onValueChange={setDrinkingMode} />
        </View>

        {/* 안전 귀가 */}
        <View style={styles.safeCard}>
          <Text style={styles.modeTitle}>안전 귀가</Text>
          <View style={styles.safeBtns}>
            <Pressable style={styles.safeBtn} onPress={openDirections}>
              <Text style={styles.safeBtnText}>🏠 집까지 길찾기</Text>
            </Pressable>
            <Pressable style={styles.safeBtn} onPress={openTaxi}>
              <Text style={styles.safeBtnText}>🚕 택시(카카오T)</Text>
            </Pressable>
          </View>
        </View>

        {/* 보조 (아이콘 버튼) */}
        <View style={styles.footerRow}>
          <Pressable style={styles.iconBtn} onPress={onEndSession}>
            <Ionicons name="flag" size={24} color={c.textMuted} />
            <Text style={styles.iconLabel}>종료</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('History')}>
            <Ionicons name="stats-chart" size={24} color={c.textMuted} />
            <Text style={styles.iconLabel}>기록</Text>
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={24} color={c.textMuted} />
            <Text style={styles.iconLabel}>설정</Text>
          </Pressable>
        </View>
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
            <Text style={styles.label}>장소 (선택)</Text>
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
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    container: { paddingHorizontal: 20, paddingTop: 16, alignItems: 'center', gap: 14 },
    scheduleBanner: { width: '100%', backgroundColor: c.amberBg, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 14 },
    scheduleText: { fontSize: 13, color: c.amber, fontWeight: '600' },
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
    thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', opacity: 0.5 },
    brakeText: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
    bacCard: { width: '100%', backgroundColor: c.card, borderRadius: radius.md, padding: 14, gap: 4 },
    bacRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    bacLabel: { fontSize: 15, color: c.text, fontWeight: '600' },
    bacValue: { fontSize: 22, fontWeight: '800' },
    disclaimer: { fontSize: 11, color: c.textFaint, marginTop: 2 },
    addRow: { width: '100%', flexDirection: 'row', gap: 10 },
    addBtn: { flex: 2, backgroundColor: c.blue, paddingVertical: 18, borderRadius: radius.lg, alignItems: 'center' },
    addBtnText: { color: '#fff', fontSize: 24, fontWeight: '800' },
    bottleBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 12, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
    bottleBtnText: { color: c.text, fontSize: 18, fontWeight: '800' },
    bottleSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    rowCard: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 16 },
    cigText: { fontSize: 15, color: c.text },
    smallBtn: { backgroundColor: c.cardAlt, paddingVertical: 7, paddingHorizontal: 18, borderRadius: radius.sm },
    smallBtnText: { fontSize: 16, fontWeight: '700', color: c.text },
    modeText: { gap: 2 },
    modeTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    safeCard: { width: '100%', backgroundColor: c.card, borderRadius: radius.md, padding: 14, gap: 10 },
    safeBtns: { flexDirection: 'row', gap: 10 },
    safeBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center' },
    safeBtnText: { fontSize: 14, color: c.text, fontWeight: '600' },
    footerRow: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%', justifyContent: 'center' },
    iconBtn: { flex: 1, maxWidth: 110, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, backgroundColor: c.card, borderRadius: radius.md },
    iconLabel: { fontSize: 12, color: c.textMuted },
    link: { fontSize: 15, color: c.blue },
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
    modalCard: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, gap: 10, borderWidth: 1, borderColor: c.border },
    modalTitle: { fontSize: 19, fontWeight: '700', color: c.text },
    label: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, color: c.text, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
    modalBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
    saveBtn: { backgroundColor: c.blue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.sm },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });

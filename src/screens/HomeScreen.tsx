import { useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';
import { useMorningSchedule } from '../calendar/useMorningSchedule';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const fmtTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function HomeScreen({ navigation }: Props) {
  const { state, addDrink, addCig, endSession, setDrinkingMode } = useAppState();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const { limit, count, cigs, unit, drinkingMode, brakePercents, repeatEveryDrinks, calendarSync } =
    state;

  // 내일 아침 일정이 있으면 브레이크를 10%p 강화
  const morning = useMorningSchedule(calendarSync);
  const effPercents = morning ? brakePercents.map((p) => Math.max(20, p - 10)) : brakePercents;

  const pct = limit > 0 ? Math.min(count / limit, 1) : 0;
  const brakeCounts = effPercents.map((p) => Math.ceil((limit * p) / 100));
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : Infinity;
  const overLimit = limit > 0 && count >= limit;
  const inBrake = limit > 0 && count >= firstBrake;

  const [endOpen, setEndOpen] = useState(false);
  const [place, setPlace] = useState('');
  const [memo, setMemo] = useState('');

  // 이번 잔으로 어떤 브레이크 지점에 '도달'했으면 인지게이트 발동
  const shouldTrigger = (n: number) => {
    if (limit <= 0) return false;
    const hitFixed = brakeCounts.includes(n);
    const repeat = n >= limit && (n - limit) % Math.max(1, repeatEveryDrinks) === 0;
    return hitFixed || repeat;
  };

  const onAddDrink = () => {
    const next = count + 1;
    addDrink();
    if (shouldTrigger(next)) navigation.navigate('CognitiveGate');
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

  const brakeText = overLimit
    ? `⚠️ 한계 초과 — 이후 ${repeatEveryDrinks}${unit}마다 알람`
    : inBrake
      ? '⚠️ 브레이크 구간'
      : `브레이크 ${effPercents.join('·')}% (${brakeCounts.join('·')}${unit})`;

  return (
    <View style={styles.container}>
      {/* 내일 아침 일정 경고 */}
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
        <Text style={styles.muted}>오늘 마신 {unit}</Text>
      </View>

      {/* 진행률 카드 (브레이크 지점마다 빨간선) */}
      <View style={styles.card}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }, inBrake && styles.fillOver]} />
          {brakePercents.map((p) => (
            <View key={p} style={[styles.thresholdLine, { left: `${Math.min(p, 100)}%` }]} />
          ))}
        </View>
        <Text style={[styles.brakeText, inBrake && styles.warnText]}>{brakeText}</Text>
      </View>

      {/* +1 단위 */}
      <Pressable style={styles.addBtn} onPress={onAddDrink}>
        <Text style={styles.addBtnText}>+1{unit}</Text>
      </Pressable>

      {/* 흡연 카운터 */}
      <View style={styles.cigCard}>
        <Text style={styles.cigText}>🚬 담배 {cigs}개비</Text>
        <Pressable style={styles.cigBtn} onPress={addCig}>
          <Text style={styles.cigBtnText}>+1</Text>
        </Pressable>
      </View>

      {/* 음주모드 토글 */}
      <View style={styles.modeCard}>
        <View style={styles.modeText}>
          <Text style={styles.modeTitle}>음주모드</Text>
          <Text style={styles.muted}>켜면 주기마다 가짜 전화가 와요</Text>
        </View>
        <Switch value={drinkingMode} onValueChange={setDrinkingMode} />
      </View>

      {/* 보조: 종료 / 기록 / 설정 */}
      <View style={[styles.footerRow, { marginBottom: insets.bottom + 16 }]}>
        <Pressable onPress={onEndSession} hitSlop={8}>
          <Text style={styles.link}>술자리 종료</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('History')} hitSlop={8}>
          <Text style={styles.link}>기록</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={8}>
          <Text style={styles.link}>설정</Text>
        </Pressable>
      </View>

      {/* 술자리 종료 모달 (장소·메모) */}
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

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 20, paddingTop: 20, alignItems: 'center', gap: 16 },
  scheduleBanner: {
    width: '100%',
    backgroundColor: c.amberBg,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  scheduleText: { fontSize: 13, color: c.amber, fontWeight: '600' },
  counterBlock: { alignItems: 'center', gap: 2, marginTop: 8 },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  countBig: { fontSize: 80, fontWeight: '800', color: c.text },
  countOver: { color: c.red },
  countLimit: { fontSize: 24, fontWeight: '600', color: c.textFaint },
  muted: { fontSize: 13, color: c.textMuted },
  warnText: { color: c.red, fontWeight: '700' },
  card: { width: '100%', gap: 10 },
  track: {
    width: '100%',
    height: 22,
    backgroundColor: c.track,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.blue, borderRadius: 11 },
  fillOver: { backgroundColor: c.red },
  thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#fff', opacity: 0.5 },
  brakeText: { fontSize: 13, color: c.textMuted, textAlign: 'center' },
  addBtn: {
    width: '100%',
    backgroundColor: c.blue,
    paddingVertical: 18,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  cigCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cigText: { fontSize: 15, color: c.text },
  cigBtn: { backgroundColor: c.cardAlt, paddingVertical: 7, paddingHorizontal: 18, borderRadius: radius.sm },
  cigBtnText: { fontSize: 16, fontWeight: '700', color: c.text },
  modeCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modeText: { gap: 2 },
  modeTitle: { fontSize: 16, fontWeight: '600', color: c.text },
  footerRow: { flexDirection: 'row', gap: 28, marginTop: 'auto' },
  link: { fontSize: 15, color: c.blue },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: c.card, borderRadius: radius.lg, padding: 20, gap: 10, borderWidth: 1, borderColor: c.border },
  modalTitle: { fontSize: 19, fontWeight: '700', color: c.text },
  label: { fontSize: 13, color: c.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.cardAlt,
    color: c.text,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 8 },
  saveBtn: { backgroundColor: c.blue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.sm },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

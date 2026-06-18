import { Alert, StyleSheet, Text, View, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { state, addDrink, endSession, setDrinkingMode } = useAppState();
  const insets = useSafeAreaInsets();

  const { limit, count, drinkingMode, brakePercents, repeatEveryDrinks } = state;
  const pct = limit > 0 ? Math.min(count / limit, 1) : 0;
  const brakeCounts = brakePercents.map((p) => Math.ceil((limit * p) / 100));
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : Infinity;
  const overLimit = limit > 0 && count >= limit;
  const inBrake = limit > 0 && count >= firstBrake;

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
    if (count <= 0) {
      Alert.alert('기록할 잔이 없어요', '마신 잔이 0이라 기록하지 않아요.');
      return;
    }
    Alert.alert('술자리 종료', `오늘 ${count}잔. 기록에 저장하고 잔수를 초기화할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '종료', onPress: endSession },
    ]);
  };

  const brakeText = overLimit
    ? `⚠️ 한계 초과 — 이후 ${repeatEveryDrinks}잔마다 알람`
    : inBrake
      ? '⚠️ 브레이크 구간'
      : `브레이크 ${brakePercents.join('·')}% (${brakeCounts.join('·')}잔)`;

  return (
    <View style={styles.container}>
      {/* 현재 잔수 */}
      <View style={styles.counterBlock}>
        <View style={styles.countRow}>
          <Text style={[styles.countBig, inBrake && styles.countOver]}>{count}</Text>
          <Text style={styles.countLimit}> / {limit}잔</Text>
        </View>
        <Text style={styles.muted}>오늘 마신 잔</Text>
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

      {/* +1잔 */}
      <Pressable style={styles.addBtn} onPress={onAddDrink}>
        <Text style={styles.addBtnText}>+1잔</Text>
      </Pressable>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center', gap: 24 },
  counterBlock: { alignItems: 'center', gap: 4 },
  countRow: { flexDirection: 'row', alignItems: 'baseline' },
  countBig: { fontSize: 80, fontWeight: '800', color: '#222' },
  countOver: { color: '#d12c2c' },
  countLimit: { fontSize: 24, fontWeight: '600', color: '#999' },
  muted: { fontSize: 14, color: '#888' },
  warnText: { color: '#d12c2c', fontWeight: '700' },
  card: { width: '100%', gap: 10 },
  track: {
    width: '100%',
    height: 24,
    backgroundColor: '#eee',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#3a7afe' },
  fillOver: { backgroundColor: '#d12c2c' },
  thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#d12c2c' },
  brakeText: { fontSize: 14, color: '#888', textAlign: 'center' },
  addBtn: {
    width: '100%',
    backgroundColor: '#222',
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  modeCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modeText: { gap: 2 },
  modeTitle: { fontSize: 17, fontWeight: '600', color: '#222' },
  footerRow: { flexDirection: 'row', gap: 28, marginTop: 'auto' },
  link: { fontSize: 15, color: '#3a7afe' },
});

import { StyleSheet, Text, View, Pressable, Switch } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

const THRESHOLD = 0.8; // 80% 인지 게이트 발동 지점

export default function HomeScreen({ navigation }: Props) {
  const { state, ready, addDrink, resetCount, setDrinkingMode } = useAppState();

  if (!ready) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>불러오는 중…</Text>
      </View>
    );
  }

  const { limit, count, drinkingMode } = state;
  const pct = limit > 0 ? Math.min(count / limit, 1) : 0;
  const thresholdCount = limit * THRESHOLD;
  const overThreshold = limit > 0 && count >= thresholdCount;

  // +1잔: 80% 선을 '넘는 순간'에만 인지 게이트 발동 (이미 넘었으면 재발동 안 함)
  const onAddDrink = () => {
    addDrink();
    if (limit > 0 && count < thresholdCount && count + 1 >= thresholdCount) {
      navigation.navigate('CognitiveGate');
    }
  };

  const brakeCount = Math.ceil(limit * THRESHOLD);

  return (
    <View style={styles.container}>
      {/* 현재 잔수 */}
      <View style={styles.counterBlock}>
        <View style={styles.countRow}>
          <Text style={[styles.countBig, overThreshold && styles.countOver]}>{count}</Text>
          <Text style={styles.countLimit}> / {limit}잔</Text>
        </View>
        <Text style={styles.muted}>오늘 마신 잔</Text>
      </View>

      {/* 진행률 카드 (80% 빨간선) */}
      <View style={styles.card}>
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${pct * 100}%` }, overThreshold && styles.fillOver]}
          />
          <View style={[styles.thresholdLine, { left: `${THRESHOLD * 100}%` }]} />
        </View>
        <Text style={[styles.brakeText, overThreshold && styles.warnText]}>
          {overThreshold ? '⚠️ 브레이크 구간 (80% 초과)' : `${brakeCount}잔에서 브레이크 (80%)`}
        </Text>
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

      {/* 보조: 초기화 / 설정 */}
      <View style={styles.footerRow}>
        <Pressable onPress={resetCount} hitSlop={8}>
          <Text style={styles.link}>잔수 초기화</Text>
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
  footerRow: { flexDirection: 'row', gap: 28, marginTop: 'auto', marginBottom: 32 },
  link: { fontSize: 15, color: '#3a7afe' },
});

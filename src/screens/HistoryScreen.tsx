import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import type { SessionRecord } from '../storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAYS[d.getDay()]}) ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

const mean = (rs: SessionRecord[]) =>
  rs.length ? rs.reduce((a, r) => a + r.count, 0) / rs.length : 0;

export default function HistoryScreen() {
  const { state, clearHistory } = useAppState();
  const { history } = state;

  const total = history.length;
  const avg = mean(history);
  const exceeded = history.filter((r) => r.count >= r.limit).length;
  const recentAvg = mean(history.filter((r) => r.endedAt >= Date.now() - WEEK_MS));

  const confirmClear = () =>
    Alert.alert('기록 전체 삭제', '모든 음주 기록을 지울까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: clearHistory },
    ]);

  const renderItem = ({ item }: { item: SessionRecord }) => {
    const over = item.count >= item.limit;
    const brake = !over && item.count >= item.limit * 0.8;
    return (
      <View style={styles.row}>
        <View>
          <Text style={styles.rowCount}>
            {item.count} <Text style={styles.rowLimit}>/ {item.limit}잔</Text>
          </Text>
          <Text style={styles.rowDate}>{fmtDate(item.endedAt)}</Text>
        </View>
        {over ? (
          <View style={[styles.badge, styles.badgeOver]}>
            <Text style={styles.badgeText}>한계 초과</Text>
          </View>
        ) : brake ? (
          <View style={[styles.badge, styles.badgeBrake]}>
            <Text style={styles.badgeText}>브레이크</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <FlatList
      contentContainerStyle={styles.container}
      data={history}
      keyExtractor={(r) => r.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={styles.stats}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{total}</Text>
            <Text style={styles.statLabel}>총 기록</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{avg.toFixed(1)}</Text>
            <Text style={styles.statLabel}>평균 잔수</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, exceeded > 0 && styles.statNumWarn]}>{exceeded}</Text>
            <Text style={styles.statLabel}>한계 초과</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{recentAvg.toFixed(1)}</Text>
            <Text style={styles.statLabel}>최근 7일 평균</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <Text style={styles.empty}>아직 기록이 없어요.{'\n'}홈에서 "술자리 종료"를 누르면 기록돼요.</Text>
      }
      ListFooterComponent={
        total > 0 ? (
          <Pressable onPress={confirmClear} style={styles.clearBtn}>
            <Text style={styles.clearText}>기록 전체 삭제</Text>
          </Pressable>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: '#222' },
  statNumWarn: { color: '#d12c2c' },
  statLabel: { fontSize: 12, color: '#888' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowCount: { fontSize: 20, fontWeight: '700', color: '#222' },
  rowLimit: { fontSize: 14, fontWeight: '500', color: '#999' },
  rowDate: { fontSize: 13, color: '#888', marginTop: 2 },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  badgeOver: { backgroundColor: '#fde0e0' },
  badgeBrake: { backgroundColor: '#fdeccf' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#a33' },
  empty: { textAlign: 'center', color: '#999', fontSize: 15, marginTop: 40, lineHeight: 22 },
  clearBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  clearText: { color: '#d12c2c', fontSize: 15 },
});

import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import type { SessionRecord } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const total = history.length;
  const avg = mean(history);
  const exceeded = history.filter((r) => r.count >= r.limit).length;
  const recentAvg = mean(history.filter((r) => r.endedAt >= Date.now() - WEEK_MS));
  const chart = history.slice(0, 12).reverse(); // 오래된→최근
  const maxCount = Math.max(1, ...chart.map((r) => r.count));

  const confirmClear = () =>
    Alert.alert('기록 전체 삭제', '모든 음주 기록을 지울까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: clearHistory },
    ]);

  const renderItem = ({ item }: { item: SessionRecord }) => {
    const over = item.count >= item.limit;
    const brake = !over && item.count >= item.limit * 0.8;
    const u = item.unit ?? '잔';
    const meta = [item.place, item.cigs ? `🚬 ${item.cigs}개비` : null].filter(Boolean).join('  ·  ');
    return (
      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowCount}>
            {item.count}{' '}
            <Text style={styles.rowLimit}>
              / {item.limit}
              {u}
            </Text>
          </Text>
          <Text style={styles.rowDate}>{fmtDate(item.endedAt)}</Text>
          {!!meta && <Text style={styles.rowMeta}>{meta}</Text>}
          {!!item.memo && <Text style={styles.rowMemo}>“{item.memo}”</Text>}
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
        <View style={{ gap: 12 }}>
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
          {chart.length >= 2 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>최근 추세 (잔수)</Text>
              <View style={styles.chart}>
                {chart.map((r) => (
                  <View key={r.id} style={styles.barWrap}>
                    <View
                      style={[
                        styles.bar,
                        { height: 6 + (r.count / maxCount) * 64 },
                        r.count >= r.limit && styles.barOver,
                      ]}
                    />
                  </View>
                ))}
              </View>
            </View>
          )}
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

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { padding: 20, gap: 12, backgroundColor: c.bg, flexGrow: 1 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: c.text },
  statNumWarn: { color: c.red },
  statLabel: { fontSize: 12, color: c.textMuted },
  chartCard: { backgroundColor: c.card, borderRadius: radius.md, padding: 14, gap: 10 },
  chartTitle: { fontSize: 13, color: c.textMuted },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 72, gap: 4 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', backgroundColor: c.blue, borderRadius: 3 },
  barOver: { backgroundColor: c.red },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowCount: { fontSize: 20, fontWeight: '700', color: c.text },
  rowLimit: { fontSize: 14, fontWeight: '500', color: c.textFaint },
  rowDate: { fontSize: 13, color: c.textMuted, marginTop: 2 },
  rowMeta: { fontSize: 13, color: c.textMuted, marginTop: 4 },
  rowMemo: { fontSize: 13, color: c.text, marginTop: 3, fontStyle: 'italic' },
  badge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  badgeOver: { backgroundColor: c.redBg },
  badgeBrake: { backgroundColor: c.amberBg },
  badgeText: { fontSize: 12, fontWeight: '600', color: c.text },
  empty: { textAlign: 'center', color: c.textMuted, fontSize: 15, marginTop: 40, lineHeight: 22 },
  clearBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  clearText: { color: c.red, fontSize: 15 },
});

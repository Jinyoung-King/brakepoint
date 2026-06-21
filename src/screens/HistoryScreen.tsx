import { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAppState } from '../state/AppStateContext';
import type { SessionRecord } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { limitStreak, sessionsThisWeek } from '../stats';

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
  const { state, clearHistory, addManualRecord } = useAppState();
  const { history, weeklyGoalSessions, limit, unit } = state;
  const streak = limitStreak(history);
  const weekCount = sessionsThisWeek(history);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const [selected, setSelected] = useState<SessionRecord | null>(null);

  // 수동 기록 입력
  const [manualOpen, setManualOpen] = useState(false);
  const [mCount, setMCount] = useState('');
  const [mLimit, setMLimit] = useState(String(limit));
  const [mDaysAgo, setMDaysAgo] = useState('0');
  const [mTime, setMTime] = useState('21:00');
  const [mPlace, setMPlace] = useState('');
  const [mMemo, setMMemo] = useState('');

  const openManual = () => {
    setMCount('');
    setMLimit(String(limit));
    setMDaysAgo('0');
    setMTime('21:00');
    setMPlace('');
    setMMemo('');
    setManualOpen(true);
  };
  const saveManual = () => {
    const count = parseInt(mCount, 10);
    if (!Number.isFinite(count) || count < 0) {
      Alert.alert('잔수를 입력해주세요');
      return;
    }
    const lim = parseInt(mLimit, 10);
    const daysAgo = parseInt(mDaysAgo, 10) || 0;
    addManualRecord({
      count,
      limit: Number.isFinite(lim) && lim >= 1 ? lim : limit,
      daysAgo,
      time: mTime,
      place: mPlace,
      memo: mMemo,
    });
    setManualOpen(false);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={openManual} hitSlop={10}>
          <Ionicons name="add" size={26} color={c.text} />
        </Pressable>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, c, limit]);

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
    const meta = [item.place, item.cigs ? `담배 ${item.cigs}개비` : null].filter(Boolean).join('  ·  ');
    return (
      <Pressable style={styles.row} onPress={() => setSelected(item)}>
        <View style={styles.rowLeft}>
          <Text style={styles.rowCount}>
            {item.count}{' '}
            <Text style={styles.rowLimit}>
              / {item.limit}
              {u}
            </Text>
          </Text>
          <Text style={styles.rowDate}>
            {item.round ? `${item.round}차 · ` : ''}
            {fmtDate(item.endedAt)}
          </Text>
          {!!meta && <Text style={styles.rowMeta}>{meta}</Text>}
          {!!item.memo && <Text style={styles.rowMemo}>“{item.memo}”</Text>}
        </View>
        <View style={styles.rowRight}>
          {over ? (
            <View style={[styles.badge, styles.badgeOver]}>
              <Text style={styles.badgeText}>한계 초과</Text>
            </View>
          ) : brake ? (
            <View style={[styles.badge, styles.badgeBrake]}>
              <Text style={styles.badgeText}>브레이크</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={18} color={c.textFaint} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
    <FlatList
      contentContainerStyle={styles.container}
      data={history}
      keyExtractor={(r) => r.id}
      renderItem={renderItem}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          {(streak > 0 || weeklyGoalSessions > 0) && (
            <View style={styles.goalCard}>
              <View style={styles.goalStreak}>
                <Ionicons name="flame" size={16} color={c.amber} />
                <Text style={styles.goalText}>한도 지킴 {streak}연속</Text>
              </View>
              {weeklyGoalSessions > 0 && (
                <Text style={[styles.goalText, weekCount > weeklyGoalSessions && styles.statNumWarn]}>
                  이번 주 {weekCount} / 목표 {weeklyGoalSessions}회
                </Text>
              )}
            </View>
          )}
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

      {/* 상세보기 */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.detailBg}>
          <View style={styles.detailCard}>
            {selected && (
              <>
                <Text style={styles.detailTitle}>
                  {selected.round ? `${selected.round}차 · ` : ''}
                  {selected.count}
                  {selected.unit ?? '잔'}
                </Text>
                <Text style={styles.muted}>{fmtDate(selected.endedAt)}</Text>
                {!!selected.place && <Text style={styles.detailMeta}>📍 {selected.place}</Text>}
                {!!selected.cigs && <Text style={styles.detailMeta}>담배 {selected.cigs}개비</Text>}
                {!!selected.memo && <Text style={styles.detailMemo}>“{selected.memo}”</Text>}

                <Text style={styles.detailSection}>시점별 음주</Text>
                {selected.events && selected.events.length > 0 ? (
                  <FlatList
                    data={selected.events}
                    keyExtractor={(_, i) => String(i)}
                    style={styles.timeline}
                    renderItem={({ item, index }) => {
                      const prev = index > 0 ? selected.events![index - 1].t : null;
                      const gap = prev ? Math.round((item.t - prev) / 60000) : null;
                      const cum = selected.events!.slice(0, index + 1).reduce((a, e) => a + e.n, 0);
                      return (
                        <View style={styles.tlRow}>
                          <Text style={styles.tlTime}>{fmtClock(item.t)}</Text>
                          <Text style={styles.tlText}>
                            +{item.n}
                            {selected.unit ?? '잔'} (누적 {cum})
                            {gap != null ? `  ·  ${gap}분 만에` : ''}
                          </Text>
                        </View>
                      );
                    }}
                  />
                ) : (
                  <Text style={styles.muted}>시점 기록이 없어요(이전 버전 기록).</Text>
                )}

                <Pressable style={styles.detailClose} onPress={() => setSelected(null)}>
                  <Text style={styles.detailCloseText}>닫기</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 수동 기록 추가 */}
      <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.detailBg}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>수동 기록 추가</Text>
            <Text style={styles.muted}>앱으로 못 센 지난 술자리를 직접 추가해요.</Text>
            <View style={styles.mRow}>
              <View style={styles.mCol}>
                <Text style={styles.mLabel}>마신 {unit}</Text>
                <TextInput style={styles.mInput} keyboardType="number-pad" value={mCount} onChangeText={setMCount} placeholder="0" placeholderTextColor={c.textFaint} />
              </View>
              <View style={styles.mCol}>
                <Text style={styles.mLabel}>한계</Text>
                <TextInput style={styles.mInput} keyboardType="number-pad" value={mLimit} onChangeText={setMLimit} placeholder={String(limit)} placeholderTextColor={c.textFaint} />
              </View>
            </View>
            <View style={styles.mRow}>
              <View style={styles.mCol}>
                <Text style={styles.mLabel}>며칠 전 (0=오늘)</Text>
                <TextInput style={styles.mInput} keyboardType="number-pad" value={mDaysAgo} onChangeText={setMDaysAgo} placeholder="0" placeholderTextColor={c.textFaint} />
              </View>
              <View style={styles.mCol}>
                <Text style={styles.mLabel}>시각 (HH:MM)</Text>
                <TextInput style={styles.mInput} value={mTime} onChangeText={setMTime} placeholder="21:00" placeholderTextColor={c.textFaint} />
              </View>
            </View>
            <Text style={styles.mLabel}>장소 (선택)</Text>
            <TextInput style={styles.mInput} value={mPlace} onChangeText={setMPlace} placeholder="예: 연신내 ○○" placeholderTextColor={c.textFaint} />
            <Text style={styles.mLabel}>메모 (선택)</Text>
            <TextInput style={styles.mInput} value={mMemo} onChangeText={setMMemo} placeholder="한줄 메모" placeholderTextColor={c.textFaint} />
            <View style={styles.mBtns}>
              <Pressable onPress={() => setManualOpen(false)} hitSlop={8}>
                <Text style={styles.clearText}>취소</Text>
              </Pressable>
              <Pressable style={styles.mSave} onPress={saveManual}>
                <Text style={styles.mSaveText}>기록 추가</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg },
  container: { padding: 20, gap: 12, backgroundColor: c.bg, flexGrow: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  detailCard: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 6, maxHeight: '80%' },
  muted: { fontSize: 13, color: c.textMuted },
  detailTitle: { fontSize: 22, fontWeight: '800', color: c.text },
  detailMeta: { fontSize: 14, color: c.textMuted, marginTop: 2 },
  detailMemo: { fontSize: 14, color: c.text, fontStyle: 'italic', marginTop: 2 },
  detailSection: { fontSize: 13, color: c.textFaint, fontWeight: '600', marginTop: 12 },
  timeline: { marginTop: 4 },
  tlRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: c.border },
  tlTime: { fontSize: 15, fontWeight: '700', color: c.text, width: 52 },
  tlText: { fontSize: 14, color: c.textMuted, flex: 1 },
  detailClose: { marginTop: 14, backgroundColor: c.cardAlt, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' },
  detailCloseText: { fontSize: 16, fontWeight: '700', color: c.text },
  mRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  mCol: { flex: 1, gap: 4 },
  mLabel: { fontSize: 13, color: c.textMuted, marginTop: 6 },
  mInput: { borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, color: c.text, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  mBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 16 },
  mSave: { backgroundColor: c.blue, paddingVertical: 12, paddingHorizontal: 20, borderRadius: radius.sm },
  mSaveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  statNum: { fontSize: 24, fontWeight: '800', color: c.text },
  statNumWarn: { color: c.red },
  statLabel: { fontSize: 12, color: c.textMuted },
  goalCard: { backgroundColor: c.card, borderRadius: radius.md, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: c.border },
  goalStreak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalText: { fontSize: 14, color: c.text, fontWeight: '600' },
  chartCard: { backgroundColor: c.card, borderRadius: radius.md, padding: 14, gap: 10, borderWidth: 1, borderColor: c.border },
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

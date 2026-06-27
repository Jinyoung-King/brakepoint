import { useLayoutEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAppState } from '../state/AppStateContext';
import type { SessionRecord } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { limitStreak, sessionsThisWeek, dailyTotals, monthSpend, monthlyReport, hourlyTotals, peakHour, placeStats } from '../stats';

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
  const { state, clearHistory, addManualRecord, deleteRecord, updateRecord } = useAppState();
  const { history, weeklyGoalSessions, limit, unit, monthlyBudget } = state;
  const [monthOffset, setMonthOffset] = useState(0);
  const streak = limitStreak(history);
  const weekCount = sessionsThisWeek(history);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const [selected, setSelected] = useState<SessionRecord | null>(null);
  // 달력 날짜 탭 → 그 날 세션 목록
  const [dayOpen, setDayOpen] = useState(false);
  const [dayRecs, setDayRecs] = useState<SessionRecord[]>([]);
  const [dayLabel, setDayLabel] = useState('');

  // 수동 기록 입력 (editingId 있으면 기존 기록 수정 모드)
  const [manualOpen, setManualOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mCount, setMCount] = useState('');
  const [mLimit, setMLimit] = useState(String(limit));
  const [mDaysAgo, setMDaysAgo] = useState('0');
  const [mTime, setMTime] = useState('21:00');
  const [mPlace, setMPlace] = useState('');
  const [mMemo, setMMemo] = useState('');
  const [mCost, setMCost] = useState('');

  const openManual = () => {
    setEditingId(null);
    setMCount('');
    setMLimit(String(limit));
    setMDaysAgo('0');
    setMTime('21:00');
    setMPlace('');
    setMMemo('');
    setMCost('');
    setManualOpen(true);
  };
  const openEdit = (rec: SessionRecord) => {
    setEditingId(rec.id);
    setMCount(String(rec.count));
    setMLimit(String(rec.limit));
    setMPlace(rec.place ?? '');
    setMMemo(rec.memo ?? '');
    setMCost(rec.cost ? String(rec.cost) : '');
    setSelected(null);
    setManualOpen(true);
  };
  const saveManual = () => {
    const count = parseInt(mCount, 10);
    if (!Number.isFinite(count) || count < 0) {
      Alert.alert('잔수를 입력해주세요');
      return;
    }
    const lim = parseInt(mLimit, 10);
    const limitVal = Number.isFinite(lim) && lim >= 1 ? lim : limit;
    const won = parseInt(mCost.replace(/[^0-9]/g, ''), 10);
    const cost = Number.isFinite(won) ? won : undefined;
    if (editingId) {
      updateRecord(editingId, { count, limit: limitVal, place: mPlace, memo: mMemo, cost });
    } else {
      addManualRecord({
        count,
        limit: limitVal,
        daysAgo: parseInt(mDaysAgo, 10) || 0,
        time: mTime,
        place: mPlace,
        memo: mMemo,
        cost,
      });
    }
    setManualOpen(false);
    setEditingId(null);
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

  // 달력(히트맵)
  const calBase = new Date();
  calBase.setDate(1);
  calBase.setMonth(calBase.getMonth() + monthOffset);
  const calYear = calBase.getFullYear();
  const calMonth = calBase.getMonth();
  const totals = dailyTotals(history, calYear, calMonth);
  const drinkingDays = Object.keys(totals).length;
  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const cellBg = (t?: number) => {
    if (!t) return c.cardAlt;
    if (t <= 2) return c.blue + '55';
    if (t <= 4) return c.blue + 'aa';
    if (t <= 7) return c.blue;
    return c.red;
  };

  // 달력 날짜 탭 → 그 날 세션들
  const openDay = (day: number) => {
    const recs = history
      .filter((r) => {
        const d = new Date(r.endedAt);
        return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
      })
      .sort((a, b) => a.endedAt - b.endedAt);
    if (recs.length === 0) return;
    setDayRecs(recs);
    setDayLabel(
      `${calYear}.${String(calMonth + 1).padStart(2, '0')}.${String(day).padStart(2, '0')} (${WEEKDAYS[new Date(calYear, calMonth, day).getDay()]})`
    );
    setDayOpen(true);
  };

  // 월간 리포트 (히트맵과 같은 달)
  const report = monthlyReport(history, calYear, calMonth);
  const wdMax = Math.max(...report.weekdayCounts, 1);

  // 비용/장소
  const spend = monthSpend(history, calYear, calMonth);
  const places = placeStats(history);

  // 시간대별 음주 (전체 기록)
  const hourly = hourlyTotals(history);
  const peakH = peakHour(hourly);
  const hourlyMax = Math.max(...hourly, 1);
  const won = (n: number) => n.toLocaleString('ko-KR');

  const confirmClear = () =>
    Alert.alert('기록 전체 삭제', '모든 음주 기록을 지울까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: clearHistory },
    ]);

  const confirmDelete = (rec: SessionRecord) =>
    Alert.alert('이 기록 삭제', '이 술자리 기록을 지울까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          deleteRecord(rec.id);
          setSelected(null);
        },
      },
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

          {/* 음주 달력 */}
          <View style={styles.chartCard}>
            <View style={styles.calHead}>
              <Pressable onPress={() => setMonthOffset((m) => m - 1)} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={c.textMuted} />
              </Pressable>
              <Text style={styles.calTitle}>
                {calYear}.{String(calMonth + 1).padStart(2, '0')} · 음주 {drinkingDays}일
              </Text>
              <Pressable
                onPress={() => setMonthOffset((m) => Math.min(0, m + 1))}
                hitSlop={10}
                disabled={monthOffset >= 0}
              >
                <Ionicons name="chevron-forward" size={20} color={monthOffset >= 0 ? c.border : c.textMuted} />
              </Pressable>
            </View>
            <View style={styles.calGrid}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.calDow}>
                  {w}
                </Text>
              ))}
              {cells.map((day, i) => (
                <View key={i} style={styles.calCellWrap}>
                  {day != null &&
                    (totals[day] ? (
                      <Pressable
                        style={[styles.calCell, { backgroundColor: cellBg(totals[day]) }]}
                        onPress={() => openDay(day)}
                      >
                        <Text style={[styles.calDay, styles.calDayOn]}>{day}</Text>
                      </Pressable>
                    ) : (
                      <View style={[styles.calCell, { backgroundColor: cellBg(totals[day]) }]}>
                        <Text style={styles.calDay}>{day}</Text>
                      </View>
                    ))}
                </View>
              ))}
            </View>
          </View>

          {/* 이번 달 리포트 */}
          {report.sessions > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>이번 달 리포트</Text>
              <View style={styles.reportRow}>
                <Text style={styles.muted}>술자리</Text>
                <Text style={styles.reportVal}>
                  {report.sessions}회
                  {report.deltaPct != null && (
                    <Text style={{ color: report.deltaPct > 0 ? c.red : c.green }}>
                      {'  '}
                      {report.deltaPct > 0 ? '+' : ''}
                      {report.deltaPct}% vs 지난달
                    </Text>
                  )}
                </Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.muted}>한계 준수율</Text>
                <Text style={styles.reportVal}>
                  {Math.round(report.withinRate * 100)}%{' '}
                  <Text style={styles.muted}>
                    ({report.withinLimit}/{report.sessions})
                  </Text>
                </Text>
              </View>
              {report.topWeekday != null && (
                <View style={styles.reportRow}>
                  <Text style={styles.muted}>최다 음주 요일</Text>
                  <Text style={styles.reportVal}>{WEEKDAYS[report.topWeekday]}요일</Text>
                </View>
              )}
              {/* 요일별 잔수 */}
              <View style={styles.wdChart}>
                {report.weekdayCounts.map((v, i) => (
                  <View key={i} style={styles.wdCol}>
                    <View style={styles.wdTrack}>
                      <View
                        style={[
                          styles.wdBar,
                          {
                            height: v > 0 ? Math.max(4, (v / wdMax) * 44) : 0,
                            backgroundColor: i === report.topWeekday ? c.blue : c.border,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.wdLabel}>{WEEKDAYS[i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 술값 / 예산 */}
          {(monthlyBudget > 0 || spend > 0) && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>이번 달 술값</Text>
              <Text style={[styles.budgetAmt, monthlyBudget > 0 && spend > monthlyBudget && styles.statNumWarn]}>
                {won(spend)}원{monthlyBudget > 0 ? ` / 예산 ${won(monthlyBudget)}원` : ''}
              </Text>
              {monthlyBudget > 0 && spend > monthlyBudget && (
                <Text style={[styles.muted, styles.statNumWarn]}>예산을 {won(spend - monthlyBudget)}원 초과했어요</Text>
              )}
            </View>
          )}

          {/* 장소별 */}
          {places.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>자주 가는 곳</Text>
              {places.map((p) => (
                <View key={p.place} style={styles.placeRow}>
                  <Text style={styles.placeName} numberOfLines={1}>
                    {p.place}
                  </Text>
                  <Text style={styles.muted}>
                    {p.sessions}회 · 평균 {p.avg.toFixed(1)}
                    {unit}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* 시간대별 음주 */}
          {peakH != null && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>주로 마시는 시간대</Text>
              <View style={styles.hourChart}>
                {hourly.map((v, i) => (
                  <View
                    key={i}
                    style={[
                      styles.hourBar,
                      {
                        height: v > 0 ? 4 + (v / hourlyMax) * 44 : 2,
                        backgroundColor: i === peakH ? c.amber : v > 0 ? c.blue : c.cardAlt,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.hourAxis}>
                {['0시', '6', '12', '18', '24'].map((l) => (
                  <Text key={l} style={styles.hourAxisLabel}>
                    {l}
                  </Text>
                ))}
              </View>
              <Text style={styles.muted}>
                가장 많이 마시는 시간대: {peakH}시–{(peakH + 1) % 24}시
              </Text>
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
                {!!selected.cigs && (
                  <Text style={styles.detailMeta}>
                    담배 {selected.cigs}개비
                    {selected.count > 0 ? ` · 잔당 ${(selected.cigs / selected.count).toFixed(1)}개비` : ''}
                  </Text>
                )}
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

                <View style={styles.detailActions}>
                  <Pressable style={styles.detailDelete} onPress={() => confirmDelete(selected)}>
                    <Ionicons name="trash-outline" size={16} color={c.red} />
                    <Text style={styles.detailDeleteText}>삭제</Text>
                  </Pressable>
                  <Pressable style={styles.detailEdit} onPress={() => openEdit(selected)}>
                    <Ionicons name="create-outline" size={16} color={c.blue} />
                    <Text style={styles.detailEditText}>수정</Text>
                  </Pressable>
                  <Pressable style={styles.detailClose} onPress={() => setSelected(null)}>
                    <Text style={styles.detailCloseText}>닫기</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 날짜별 세션 목록 (달력 탭) */}
      <Modal visible={dayOpen} transparent animationType="slide" onRequestClose={() => setDayOpen(false)}>
        <View style={styles.detailBg}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{dayLabel}</Text>
            <Text style={styles.muted}>
              {dayRecs.length}건 · 총 {dayRecs.reduce((a, r) => a + r.count, 0)}
              {unit}
            </Text>
            {dayRecs.map((r) => (
              <Pressable
                key={r.id}
                style={styles.dayRow}
                onPress={() => {
                  setDayOpen(false);
                  setSelected(r);
                }}
              >
                <Text style={styles.dayRowText} numberOfLines={1}>
                  {r.round ? `${r.round}차 · ` : ''}
                  {r.count}
                  {r.unit ?? unit}
                  {r.count >= r.limit ? ' ⚠️' : ''}
                  {r.place ? ` · ${r.place}` : ''}
                </Text>
                <Text style={styles.dayRowTime}>{fmtClock(r.endedAt)}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.detailClose} onPress={() => setDayOpen(false)}>
              <Text style={styles.detailCloseText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 수동 기록 추가 */}
      <Modal visible={manualOpen} transparent animationType="slide" onRequestClose={() => setManualOpen(false)}>
        <View style={styles.detailBg}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{editingId ? '기록 수정' : '수동 기록 추가'}</Text>
            <Text style={styles.muted}>
              {editingId ? '날짜는 그대로 두고 내용만 수정해요.' : '앱으로 못 센 지난 술자리를 직접 추가해요.'}
            </Text>
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
            {!editingId && (
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
            )}
            <Text style={styles.mLabel}>장소 (선택)</Text>
            <TextInput style={styles.mInput} value={mPlace} onChangeText={setMPlace} placeholder="예: 연신내 ○○" placeholderTextColor={c.textFaint} />
            <Text style={styles.mLabel}>메모 (선택)</Text>
            <TextInput style={styles.mInput} value={mMemo} onChangeText={setMMemo} placeholder="한줄 메모" placeholderTextColor={c.textFaint} />
            <Text style={styles.mLabel}>술값 (선택, 원)</Text>
            <TextInput style={styles.mInput} keyboardType="number-pad" value={mCost} onChangeText={setMCost} placeholder="예: 35000" placeholderTextColor={c.textFaint} />
            <View style={styles.mBtns}>
              <Pressable onPress={() => { setManualOpen(false); setEditingId(null); }} hitSlop={8}>
                <Text style={styles.clearText}>취소</Text>
              </Pressable>
              <Pressable style={styles.mSave} onPress={saveManual}>
                <Text style={styles.mSaveText}>{editingId ? '수정 저장' : '기록 추가'}</Text>
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
  container: { padding: 20, paddingBottom: 110, gap: 12, backgroundColor: c.bg, flexGrow: 1 },
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
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: c.border },
  dayRowText: { flex: 1, fontSize: 15, color: c.text },
  dayRowTime: { fontSize: 13, color: c.textMuted },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  detailDelete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.red },
  detailDeleteText: { fontSize: 16, fontWeight: '700', color: c.red },
  detailEdit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, borderColor: c.blue },
  detailEditText: { fontSize: 16, fontWeight: '700', color: c.blue },
  detailClose: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' },
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
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calDow: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: c.textFaint, marginBottom: 4 },
  calCellWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  calCell: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  calDay: { fontSize: 12, color: c.textMuted },
  calDayOn: { color: '#fff', fontWeight: '700' },
  budgetAmt: { fontSize: 22, fontWeight: '800', color: c.text },
  placeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  hourChart: { flexDirection: 'row', alignItems: 'flex-end', height: 50, gap: 2 },
  hourBar: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  hourAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  hourAxisLabel: { fontSize: 10, color: c.textFaint },
  placeName: { fontSize: 14, color: c.text, fontWeight: '600', flex: 1 },
  chartTitle: { fontSize: 13, color: c.textMuted },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportVal: { fontSize: 14, color: c.text, fontWeight: '600' },
  wdChart: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 6, marginTop: 4 },
  wdCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  wdTrack: { width: '100%', height: 44, justifyContent: 'flex-end', alignItems: 'center' },
  wdBar: { width: '70%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  wdLabel: { fontSize: 11, color: c.textFaint },
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

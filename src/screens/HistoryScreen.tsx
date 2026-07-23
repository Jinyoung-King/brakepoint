import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAppState } from '../state/AppStateContext';
import type { SessionRecord, DrinkType, DrinkUnit } from '../storage';
import { DRINK_TYPES, DRINK_UNITS, WEEKDAYS } from '../constants';
import ManualAddChat from './ManualAddChat';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { limitStreak, sessionsThisWeek, dailyTotals, monthSpend, monthlyReport, hourlyTotals, peakHour, placeStats, typeTotals, dryStats, monthDryDays, computeGoals, alcoholKcal, spendEquivalents, kcalEquivalents, morningInsight } from '../stats';
import MorningCheckSheet from '../MorningCheckSheet';
import { sessionStdCount, STD_GRAMS } from '../bac';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} (${WEEKDAYS[d.getDay()]}) ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

const mean = (rs: SessionRecord[]) =>
  rs.length ? rs.reduce((a, r) => a + r.count, 0) / rs.length : 0;

const HANGOVER_LABELS = ['쌩쌩', '약간', '꽤', '최악'] as const;
const SLEEP_LABELS = ['푹 잤다', '그럭저럭', '설쳤다'] as const;
const hangoverLabel = (h: number) => HANGOVER_LABELS[Math.min(3, Math.max(0, h))];

export default function HistoryScreen() {
  const { state, clearHistory, addManualRecord, deleteRecord, updateRecord, setMorningLog } = useAppState();
  const { history, weeklyGoalSessions, monthlyDryGoal, limit, unit, monthlyBudget, drinkType, customDrinks } = state;
  const [monthOffset, setMonthOffset] = useState(0);
  const streak = limitStreak(history);
  const weekCount = sessionsThisWeek(history);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const navigation = useNavigation();
  const [selected, setSelected] = useState<SessionRecord | null>(null);
  const [condTarget, setCondTarget] = useState<SessionRecord | null>(null);
  // 달력 날짜 탭 → 그 날 세션 목록
  const [dayOpen, setDayOpen] = useState(false);
  const [statKey, setStatKey] = useState<string | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [dayRecs, setDayRecs] = useState<SessionRecord[]>([]);
  const [dayLabel, setDayLabel] = useState('');

  // 추가는 카톡형 대화(ManualAddChat), 수정(editingId)은 아래 폼을 쓴다.
  const [manualOpen, setManualOpen] = useState(false); // 카톡형 추가 열림
  const [chatInitialWhen, setChatInitialWhen] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null이 아니면 수정 폼
  const [mCount, setMCount] = useState('');
  const [mLimit, setMLimit] = useState(String(limit));
  const [mPlace, setMPlace] = useState('');
  const [mMemo, setMMemo] = useState('');
  const [mCost, setMCost] = useState('');
  const [mType, setMType] = useState<DrinkType>(drinkType);
  const [mUnit, setMUnit] = useState<DrinkUnit>(unit);
  const [mWhen, setMWhen] = useState(() => new Date()); // 수정 중인 기록의 날짜·시각
  const [editPicker, setEditPicker] = useState<'date' | 'time' | null>(null);

  const openManual = (when?: Date | null) => {
    setEditingId(null);
    setChatInitialWhen(when ?? null);
    setManualOpen(true);
  };
  // 캘린더 빈 날짜 탭 → 그 날짜로 수동 추가 (해당 날짜로 대화 시작)
  const openManualForDate = (day: number) => {
    openManual(new Date(calYear, calMonth, day));
  };
  const openEdit = (rec: SessionRecord) => {
    setEditingId(rec.id);
    setMCount(String(rec.count));
    setMLimit(String(rec.limit));
    setMPlace(rec.place ?? '');
    setMMemo(rec.memo ?? '');
    setMCost(rec.cost ? String(rec.cost) : '');
    setMType(rec.events?.[0]?.type ?? drinkType);
    setMUnit(rec.unit ?? unit);
    setMWhen(new Date(rec.endedAt));
    setEditPicker(null);
    setSelected(null);
  };
  // 카톡형 대화 완료 → 기록 추가
  const submitChat = (input: Parameters<typeof addManualRecord>[0]) => {
    addManualRecord(input);
    setManualOpen(false);
  };
  // 수정 폼 저장
  const saveEdit = () => {
    if (!editingId) return;
    const count = parseFloat(mCount);
    if (!Number.isFinite(count) || count < 0) {
      Alert.alert('잔수를 입력해주세요');
      return;
    }
    const lim = parseInt(mLimit, 10);
    const limitVal = Number.isFinite(lim) && lim >= 1 ? lim : limit;
    const won = parseInt(mCost.replace(/[^0-9]/g, ''), 10);
    const cost = Number.isFinite(won) ? won : undefined;
    updateRecord(editingId, { count, limit: limitVal, place: mPlace, memo: mMemo, cost, type: mType, unit: mUnit, at: mWhen.getTime() });
    setEditingId(null);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => openManual()} hitSlop={10} accessibilityRole="button" accessibilityLabel="수동 기록 추가">
          <Ionicons name="add" size={26} color={c.text} />
        </Pressable>
      ),
    });
  }, [navigation, c, limit]);

  const total = history.length;
  const avg = mean(history);
  const exceeded = history.filter((r) => r.count >= r.limit).length;
  const recentAvg = mean(history.filter((r) => r.endedAt >= Date.now() - WEEK_MS));
  const chart = history.slice(0, 12).reverse(); // 오래된→최근

  // 요약 지표 탭 시 상세 통계
  const nowMs = Date.now();
  const weekRecs = history.filter((r) => r.endedAt >= nowMs - WEEK_MS);
  const prevWeekRecs = history.filter(
    (r) => r.endedAt < nowMs - WEEK_MS && r.endedAt >= nowMs - 2 * WEEK_MS
  );
  const tNow = new Date();
  const monthRecs = history.filter((r) => {
    const d = new Date(r.endedAt);
    return d.getFullYear() === tNow.getFullYear() && d.getMonth() === tNow.getMonth();
  });
  const maxInSession = total ? Math.max(...history.map((r) => r.count)) : 0;
  const firstMs = total ? Math.min(...history.map((r) => r.endedAt)) : 0;
  const lastMs = total ? Math.max(...history.map((r) => r.endedAt)) : 0;
  const fmtYMD = (ms: number) => {
    const d = new Date(ms);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const pctStr = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '0%');
  const STAT_TITLES: Record<string, string> = {
    total: '총 기록 상세',
    avg: '평균 잔수 상세',
    exceeded: '한계 초과 상세',
    recent: '최근 7일 상세',
  };
  const statRows = (key: string): { label: string; value: string; warn?: boolean }[] => {
    if (key === 'total') {
      return [
        { label: '총 술자리', value: `${total}회` },
        { label: '이번 달', value: `${monthRecs.length}회` },
        { label: '최근 7일', value: `${weekRecs.length}회` },
        { label: '첫 기록', value: total ? fmtYMD(firstMs) : '-' },
        { label: '최근 기록', value: total ? fmtYMD(lastMs) : '-' },
      ];
    }
    if (key === 'avg') {
      return [
        { label: '전체 평균', value: `${avg.toFixed(1)}잔` },
        { label: '이번 달 평균', value: `${mean(monthRecs).toFixed(1)}잔` },
        { label: '최근 7일 평균', value: `${recentAvg.toFixed(1)}잔` },
        { label: '한 자리 최다', value: `${maxInSession}잔` },
      ];
    }
    if (key === 'exceeded') {
      const weekEx = weekRecs.filter((r) => r.count >= r.limit).length;
      return [
        { label: '총 초과', value: `${exceeded}회`, warn: exceeded > 0 },
        { label: '초과율', value: pctStr(exceeded, total) },
        { label: '한도 지킴 연속', value: `${streak}회` },
        { label: '최근 7일 초과', value: `${weekEx}회`, warn: weekEx > 0 },
      ];
    }
    // recent
    const prevAvg = mean(prevWeekRecs);
    const diff = recentAvg - prevAvg;
    const diffStr = prevWeekRecs.length === 0 ? '-' : `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}잔`;
    return [
      { label: '최근 7일 평균', value: `${recentAvg.toFixed(1)}잔` },
      { label: '최근 7일 술자리', value: `${weekRecs.length}회` },
      { label: '전체 평균 대비', value: `${(recentAvg - avg >= 0 ? '+' : '') + (recentAvg - avg).toFixed(1)}잔`, warn: recentAvg > avg },
      { label: '지난주 대비', value: diffStr, warn: diff > 0 },
    ];
  };
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
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const isFutureDay = (day: number) => new Date(calYear, calMonth, day).getTime() > todayMid.getTime();
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

  // 음주 결산 (표시 중인 달 기준)
  const recapRecs = history.filter((r) => {
    const d = new Date(r.endedAt);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });
  const recapDrinks = recapRecs.reduce((a, r) => a + r.count, 0);
  const recapAvg = report.sessions ? recapDrinks / report.sessions : 0;
  const recapTopType = typeTotals(recapRecs)[0];
  const recapTopPlace = placeStats(recapRecs)[0];
  const recapWeekday = report.topWeekday != null ? `${WEEKDAYS[report.topWeekday]}요일` : '-';
  const recapTitle = `${calYear}.${String(calMonth + 1).padStart(2, '0')} 음주 결산`;
  // 이번 달 한줄평(등급) + 그에 맞는 카드 그라데이션 색
  const recapVerdict: { title: string; colors: readonly [string, string] } =
    report.sessions === 0
      ? { title: '클린한 한 달', colors: ['#22c1c3', '#3a7afe'] }
      : report.withinRate >= 0.8
        ? { title: '절제의 달인', colors: ['#11998e', '#38ef7d'] }
        : report.sessions >= 8
          ? { title: '이번 달 좀 달렸다', colors: ['#f7415f', '#7b2ff7'] }
          : { title: '적당주의자', colors: ['#3a7afe', '#7b2ff7'] };
  const recapText =
    report.sessions === 0
      ? `${recapTitle}\n이번 달은 술자리 기록이 없어요.\n— 브레이크포인트`
      : [
          recapTitle,
          `· 술자리 ${report.sessions}회${report.deltaPct != null ? ` (지난달 ${report.deltaPct >= 0 ? '+' : ''}${report.deltaPct}%)` : ''}`,
          `· 총 ${recapDrinks}잔 · 평균 ${recapAvg.toFixed(1)}잔`,
          `· 한도 지킴 ${report.withinLimit}/${report.sessions} (${Math.round(report.withinRate * 100)}%)`,
          `· 최다 요일 ${recapWeekday}`,
          recapTopType ? `· 주종 1위 ${recapTopType.type} ${recapTopType.count}잔` : null,
          recapTopPlace ? `· 단골 ${recapTopPlace.place} ${recapTopPlace.sessions}회` : null,
          report.spend > 0 ? `· 술값 ${report.spend.toLocaleString('ko-KR')}원` : null,
          '— 브레이크포인트',
        ]
          .filter(Boolean)
          .join('\n');
  const recapShotRef = useRef<View>(null);
  // 결산 카드를 이미지로 캡처해 공유(카톡/인스타 등). 실패하면 텍스트 공유로 폴백.
  const shareRecap = async () => {
    try {
      const uri = await captureRef(recapShotRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: '음주 결산 공유' });
        return;
      }
      throw new Error('sharing-unavailable');
    } catch {
      try {
        await Share.share({ message: recapText });
      } catch {
        // 취소 등 무시
      }
    }
  };

  // 수정 폼 잔수 스테퍼: 0 아래로는 안 내려감. 소수(0.5잔 등)도 유지.
  const bumpCount = (delta: number) => {
    const cur = parseFloat(mCount) || 0;
    const next = Math.max(0, Math.round((cur + delta) * 100) / 100);
    setMCount(String(next));
  };

  // 비용/장소
  const spend = monthSpend(history, calYear, calMonth);
  // 이번 달 섭취 순알코올(g)→kcal. 기록별 표준잔×8g 합산(커스텀 주종 반영).
  const monthGrams = history
    .filter((r) => {
      const d = new Date(r.endedAt);
      return d.getFullYear() === calYear && d.getMonth() === calMonth;
    })
    .reduce(
      (a, r) => a + sessionStdCount(r.events ?? [], r.count, r.unit ?? unit, r.events?.[0]?.type ?? drinkType, customDrinks) * STD_GRAMS,
      0
    );
  const monthKcal = alcoholKcal(monthGrams);
  const spendEq = spendEquivalents(spend);
  const kcalEq = kcalEquivalents(monthKcal);
  const places = placeStats(history);
  const byType = typeTotals(history);
  const mInsight = morningInsight(history);
  const typeMax = Math.max(1, ...byType.map((t) => t.count));
  // 금주 현황
  const dry = dryStats(history, nowMs);
  const monthDry = monthDryDays(history, nowMs);
  const goals = computeGoals({
    weekSessions: weekCount,
    weekGoal: weeklyGoalSessions,
    dryDays: monthDry.dry,
    dryGoal: monthlyDryGoal,
    streak,
  });

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
      <Pressable
        style={styles.row}
        onPress={() => setSelected(item)}
        accessibilityRole="button"
        accessibilityLabel={`${fmtDate(item.endedAt)}, ${item.count}${u} 기록. 탭하면 상세`}
      >
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
          {item.morning && (
            <Text style={[styles.rowMeta, { color: [c.green, c.green, c.amber, c.red][item.morning.hangover] }]}>
              다음날 숙취 {hangoverLabel(item.morning.hangover)}
            </Text>
          )}
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
          {(goals.streak > 0 || goals.week || goals.dry) && (
            <View style={styles.goalCard}>
              <View style={styles.goalHeaderRow}>
                <Text style={styles.goalTitle}>목표</Text>
                <View style={styles.goalStreak}>
                  <Ionicons name="flame" size={15} color={goals.streak > 0 ? c.amber : c.textFaint} />
                  <Text style={styles.goalStreakText}>한도 지킴 {goals.streak}연속</Text>
                </View>
              </View>
              {goals.week && (
                <GoalRow
                  label="이번 주 술자리"
                  value={`${goals.week.count} / ${goals.week.goal}회`}
                  ratio={goals.week.goal > 0 ? goals.week.count / goals.week.goal : 0}
                  met={goals.week.met}
                  overColor={c.red}
                  styles={styles}
                  c={c}
                />
              )}
              {goals.dry && (
                <GoalRow
                  label="이번 달 금주일"
                  value={`${goals.dry.days} / ${goals.dry.goal}일`}
                  ratio={goals.dry.goal > 0 ? goals.dry.days / goals.dry.goal : 0}
                  met={goals.dry.met}
                  styles={styles}
                  c={c}
                />
              )}
              {!goals.week && !goals.dry && (
                <Text style={styles.goalHint}>설정 &gt; 건강·목표에서 주간/금주일 목표를 정하면 여기 진행률이 떠요.</Text>
              )}
            </View>
          )}
          <View style={styles.stats}>
            <Pressable style={styles.statBox} onPress={() => setStatKey('total')}>
              <Text style={styles.statNum}>{total}</Text>
              <Text style={styles.statLabel}>총 기록</Text>
            </Pressable>
            <Pressable style={styles.statBox} onPress={() => setStatKey('avg')}>
              <Text style={styles.statNum}>{avg.toFixed(1)}</Text>
              <Text style={styles.statLabel}>평균 잔수</Text>
            </Pressable>
            <Pressable style={styles.statBox} onPress={() => setStatKey('exceeded')}>
              <Text style={[styles.statNum, exceeded > 0 && styles.statNumWarn]}>{exceeded}</Text>
              <Text style={styles.statLabel}>한계 초과</Text>
            </Pressable>
            <Pressable style={styles.statBox} onPress={() => setStatKey('recent')}>
              <Text style={styles.statNum}>{recentAvg.toFixed(1)}</Text>
              <Text style={styles.statLabel}>최근 7일 평균</Text>
            </Pressable>
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
              <Pressable onPress={() => setMonthOffset((m) => m - 1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="이전 달">
                <Ionicons name="chevron-back" size={20} color={c.textMuted} />
              </Pressable>
              <Text style={styles.calTitle}>
                {calYear}.{String(calMonth + 1).padStart(2, '0')} · 음주 {drinkingDays}일
              </Text>
              <Pressable
                onPress={() => setMonthOffset((m) => Math.min(0, m + 1))}
                hitSlop={10}
                disabled={monthOffset >= 0}
                accessibilityRole="button"
                accessibilityLabel="다음 달"
                accessibilityState={{ disabled: monthOffset >= 0 }}
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
                        accessibilityRole="button"
                        accessibilityLabel={`${day}일, 음주 ${totals[day]}잔. 탭하면 상세`}
                      >
                        <Text style={[styles.calDay, styles.calDayOn]}>{day}</Text>
                      </Pressable>
                    ) : isFutureDay(day) ? (
                      <View style={[styles.calCell, { backgroundColor: cellBg(totals[day]) }]}>
                        <Text style={styles.calDay}>{day}</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={[styles.calCell, { backgroundColor: cellBg(totals[day]) }]}
                        onPress={() => openManualForDate(day)}
                        accessibilityRole="button"
                        accessibilityLabel={`${day}일, 기록 없음. 탭하면 기록 추가`}
                      >
                        <Text style={styles.calDay}>{day}</Text>
                      </Pressable>
                    ))}
                </View>
              ))}
            </View>
          </View>

          {/* 금주 현황 */}
          {total > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>금주 현황</Text>
              <View style={styles.dryHero}>
                <Text style={styles.dryHeroNum}>{dry.current}</Text>
                <Text style={styles.dryHeroUnit}>{dry.current === 0 ? '일 · 오늘 음주' : '일째 금주 중'}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.muted}>최장 금주</Text>
                <Text style={styles.reportVal}>{dry.longest}일</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.muted}>이번 달</Text>
                <Text style={styles.reportVal}>음주 {monthDry.drinking}일 · 금주 {monthDry.dry}일</Text>
              </View>
            </View>
          )}

          {/* 결산 공유 */}
          <Pressable style={styles.recapBtn} onPress={() => setRecapOpen(true)}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.recapBtnText}>{calMonth + 1}월 결산 보기</Text>
          </Pressable>

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

          {/* 비교 인사이트: 술값·칼로리를 친숙한 것으로 환산 */}
          {(spendEq.length > 0 || kcalEq.length > 0) && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>이번 달, 이만큼이에요</Text>
              {spendEq.length > 0 && (
                <View style={styles.eqRow}>
                  <Text style={styles.eqLead}>술값이면</Text>
                  <View style={styles.eqChips}>
                    {spendEq.map((e) => (
                      <View key={e.label} style={styles.eqChip}>
                        <Text style={styles.eqChipText}>{e.label} {e.n}{e.label === '치킨' ? '마리' : e.label === '영화' ? '편' : '잔'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {kcalEq.length > 0 && (
                <View style={styles.eqRow}>
                  <Text style={styles.eqLead}>알코올 {won(monthKcal)}kcal ≈</Text>
                  <View style={styles.eqChips}>
                    {kcalEq.map((e) => (
                      <View key={e.label} style={styles.eqChip}>
                        <Text style={styles.eqChipText}>{e.label} {e.n}{e.label === '밥 공기' ? '공기' : '개'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* 다음날 컨디션 인사이트: 숙취 ↔ 마신 양 상관 */}
          {mInsight && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>다음날 컨디션</Text>
              {mInsight.hardN > 0 && mInsight.easyN > 0 && mInsight.hardAvg - mInsight.easyAvg >= 0.5 ? (
                <Text style={styles.morningLead}>
                  숙취 심했던 날은 평균 <Text style={{ color: c.red, fontWeight: '700' }}>{mInsight.hardAvg.toFixed(1)}잔</Text>,
                  {' '}괜찮았던 날은 <Text style={{ color: c.green, fontWeight: '700' }}>{mInsight.easyAvg.toFixed(1)}잔</Text>.
                  {' '}약 {(mInsight.hardAvg - mInsight.easyAvg).toFixed(1)}잔 차이예요.
                </Text>
              ) : (
                <Text style={styles.morningLead}>
                  컨디션을 {mInsight.logged}번 기록했어요. 조금씩 패턴이 보일 거예요.
                </Text>
              )}
              {mInsight.regretN > 0 && (
                <Text style={styles.muted}>“다음엔 덜 마실래” {mInsight.regretN}번 눌렀어요</Text>
              )}
            </View>
          )}

          {/* 주종별 섭취 */}
          {byType.length > 0 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>주종별 섭취</Text>
              {byType.map((t) => (
                <View key={t.type} style={styles.typeStatRow}>
                  <Text style={styles.typeStatName}>{t.type}</Text>
                  <View style={styles.typeStatTrack}>
                    <View style={[styles.typeStatFill, { width: `${(t.count / typeMax) * 100}%` }]} />
                  </View>
                  <Text style={styles.typeStatNum}>
                    {t.count}
                    {unit}
                  </Text>
                </View>
              ))}
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

                {(() => {
                  const m = history.find((r) => r.id === selected.id)?.morning;
                  return (
                    <>
                      {m && (
                        <View style={styles.morningBox}>
                          <Text style={styles.morningBoxText}>
                            다음날 숙취 <Text style={{ color: [c.green, c.green, c.amber, c.red][m.hangover], fontWeight: '700' }}>{hangoverLabel(m.hangover)}</Text>
                            {m.sleep != null ? ` · 수면 ${SLEEP_LABELS[m.sleep]}` : ''}
                            {m.regret ? ' · 다음엔 덜' : ''}
                          </Text>
                          {!!m.note && <Text style={styles.detailMemo}>“{m.note}”</Text>}
                        </View>
                      )}
                      <Pressable
                        style={styles.morningBtn}
                        onPress={() => {
                          const fresh = history.find((r) => r.id === selected.id) ?? selected;
                          setSelected(null);
                          setCondTarget(fresh);
                        }}
                        accessibilityRole="button"
                      >
                        <Ionicons name="sunny-outline" size={16} color={c.blue} />
                        <Text style={styles.morningBtnText}>{m ? '다음날 컨디션 수정' : '다음날 컨디션 기록'}</Text>
                      </Pressable>
                    </>
                  );
                })()}

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

      {/* 음주 결산 공유 카드 */}
      <Modal visible={recapOpen} transparent animationType="fade" onRequestClose={() => setRecapOpen(false)}>
        <Pressable style={styles.recapBg} onPress={() => setRecapOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%' }}>
            <View ref={recapShotRef} collapsable={false} style={styles.recapShot}>
            <LinearGradient colors={recapVerdict.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.recapCard}>
              <View style={styles.recapBlob1} />
              <View style={styles.recapBlob2} />
              <View style={styles.recapHeader}>
                <Text style={styles.recapBrand}>BRAKEPOINT</Text>
                <Text style={styles.recapCardTitle}>{recapTitle}</Text>
              </View>
              <Text style={styles.recapVerdictLabel}>이번 달</Text>
              <Text style={styles.recapVerdictTitle}>{recapVerdict.title}</Text>
              {report.sessions === 0 ? (
                <Text style={styles.recapEmpty}>이번 달 술자리 0회 — 잘했어요</Text>
              ) : (
                <>
                  <View style={styles.recapHero}>
                    <Text style={styles.recapHeroNum}>{report.sessions}</Text>
                    <Text style={styles.recapHeroUnit}>회 술자리</Text>
                    {report.deltaPct != null && (
                      <Text style={styles.recapDelta}>
                        지난달 {report.deltaPct >= 0 ? '+' : ''}
                        {report.deltaPct}%
                      </Text>
                    )}
                  </View>
                  <View style={styles.recapDivider} />
                  {[
                    { l: '총 · 평균', v: `${recapDrinks}잔 · ${recapAvg.toFixed(1)}잔` },
                    { l: '한도 지킴', v: `${report.withinLimit}/${report.sessions} · ${Math.round(report.withinRate * 100)}%` },
                    { l: '최다 요일', v: recapWeekday },
                    ...(recapTopType ? [{ l: '주종 1위', v: `${recapTopType.type} ${recapTopType.count}잔` }] : []),
                    ...(recapTopPlace ? [{ l: '단골', v: `${recapTopPlace.place} ${recapTopPlace.sessions}회` }] : []),
                    ...(report.spend > 0 ? [{ l: '술값', v: `${won(report.spend)}원` }] : []),
                  ].map((r) => (
                    <View key={r.l} style={styles.recapRow}>
                      <Text style={styles.recapRowLabel}>{r.l}</Text>
                      <Text style={styles.recapRowValue}>{r.v}</Text>
                    </View>
                  ))}
                </>
              )}
            </LinearGradient>
            </View>
            <View style={styles.recapActions}>
              <Pressable style={styles.recapCloseBtn} onPress={() => setRecapOpen(false)}>
                <Text style={styles.detailCloseText}>닫기</Text>
              </Pressable>
              <Pressable style={styles.recapShareBtn} onPress={shareRecap}>
                <Ionicons name="share-social" size={16} color="#fff" />
                <Text style={styles.recapShareText}>공유</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 요약 지표 상세 통계 */}
      <Modal visible={statKey != null} transparent animationType="slide" onRequestClose={() => setStatKey(null)}>
        <Pressable style={styles.detailBg} onPress={() => setStatKey(null)}>
          <Pressable style={styles.detailCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.detailTitle}>{statKey ? STAT_TITLES[statKey] : ''}</Text>
            {statKey &&
              statRows(statKey).map((r) => (
                <View key={r.label} style={styles.reportRow}>
                  <Text style={styles.muted}>{r.label}</Text>
                  <Text style={[styles.statRowValue, r.warn && styles.statNumWarn]}>{r.value}</Text>
                </View>
              ))}
            {total === 0 && <Text style={styles.muted}>아직 기록이 없어요.</Text>}
            <Pressable style={[styles.detailClose, { marginTop: 8 }]} onPress={() => setStatKey(null)}>
              <Text style={styles.detailCloseText}>닫기</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 수동 기록 추가 — 카톡형 대화 */}
      <ManualAddChat
        visible={manualOpen}
        initialWhen={chatInitialWhen}
        limit={limit}
        defaultType={drinkType}
        defaultUnit={unit}
        drinkTypes={[...DRINK_TYPES, ...customDrinks.map((cd) => cd.name)]}
        onCancel={() => setManualOpen(false)}
        onSubmit={submitChat}
      />

      {/* 기록 수정 */}
      <Modal visible={editingId != null} transparent animationType="slide" onRequestClose={() => setEditingId(null)}>
        <KeyboardAvoidingView
          style={styles.detailBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>기록 수정</Text>
            <Text style={styles.muted}>날짜·시각과 내용을 바꿀 수 있어요.</Text>
            <ScrollView style={styles.mScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.mLabel}>날짜 · 시각</Text>
              <View style={styles.mChips}>
                <Pressable style={styles.mChip} onPress={() => setEditPicker('date')} accessibilityRole="button" accessibilityLabel="날짜 바꾸기">
                  <Text style={styles.mChipText}>📅 {mWhen.getMonth() + 1}월 {mWhen.getDate()}일 ({WEEKDAYS[mWhen.getDay()]})</Text>
                </Pressable>
                <Pressable style={styles.mChip} onPress={() => setEditPicker('time')} accessibilityRole="button" accessibilityLabel="시각 바꾸기">
                  <Text style={styles.mChipText}>🕘 {fmtClock(mWhen.getTime())}</Text>
                </Pressable>
              </View>
              <Text style={styles.mLabel}>주종</Text>
              <View style={styles.mChips}>
                {[...DRINK_TYPES, ...customDrinks.map((cd) => cd.name)].map((t) => {
                  const on = t === mType;
                  return (
                    <Pressable key={t} style={[styles.mChip, on && styles.mChipOn]} onPress={() => setMType(t)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`주종 ${t}`}>
                      <Text style={[styles.mChipText, on && styles.mChipTextOn]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.mLabel}>단위</Text>
              <View style={styles.mChips}>
                {DRINK_UNITS.map((u) => {
                  const on = u === mUnit;
                  return (
                    <Pressable key={u} style={[styles.mChip, on && styles.mChipOn]} onPress={() => setMUnit(u)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`단위 ${u}`}>
                      <Text style={[styles.mChipText, on && styles.mChipTextOn]}>{u}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.mLabel}>마신 양</Text>
              <View style={styles.mSentence}>
                <View style={styles.mStepper}>
                  <Pressable style={styles.mStepBtn} onPress={() => bumpCount(-1)} accessibilityRole="button" accessibilityLabel="하나 빼기">
                    <Text style={styles.mStepBtnText}>−</Text>
                  </Pressable>
                  <TextInput style={styles.mCountInput} keyboardType="decimal-pad" value={mCount} onChangeText={setMCount} placeholder="0" placeholderTextColor={c.textFaint} textAlign="center" accessibilityLabel={`마신 ${mUnit}`} />
                  <Pressable style={styles.mStepBtn} onPress={() => bumpCount(1)} accessibilityRole="button" accessibilityLabel="하나 더하기">
                    <Text style={styles.mStepBtnText}>＋</Text>
                  </Pressable>
                </View>
                <Text style={styles.mSentenceText}>{mUnit}</Text>
              </View>
              <Text style={styles.mLabel}>선택 항목</Text>
              <View style={styles.mRow}>
                <View style={styles.mCol}>
                  <Text style={styles.mSubLabel}>한도 ({mUnit})</Text>
                  <TextInput style={styles.mInput} keyboardType="number-pad" value={mLimit} onChangeText={setMLimit} placeholder={String(limit)} placeholderTextColor={c.textFaint} />
                </View>
                <View style={styles.mCol}>
                  <Text style={styles.mSubLabel}>술값 (원)</Text>
                  <TextInput style={styles.mInput} keyboardType="number-pad" value={mCost} onChangeText={setMCost} placeholder="예: 35000" placeholderTextColor={c.textFaint} />
                </View>
              </View>
              <Text style={styles.mSubLabel}>장소</Text>
              <TextInput style={styles.mInput} value={mPlace} onChangeText={setMPlace} placeholder="예: 연신내 ○○" placeholderTextColor={c.textFaint} />
              <Text style={styles.mSubLabel}>메모</Text>
              <TextInput style={styles.mInput} value={mMemo} onChangeText={setMMemo} placeholder="한줄 메모" placeholderTextColor={c.textFaint} />
            </ScrollView>
            <View style={styles.mBtns}>
              <Pressable onPress={() => setEditingId(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="취소">
                <Text style={styles.clearText}>취소</Text>
              </Pressable>
              <Pressable style={styles.mSave} onPress={saveEdit} accessibilityRole="button" accessibilityLabel="수정 저장">
                <Text style={styles.mSaveText}>수정 저장</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
        {editPicker && (
          <DateTimePicker
            value={mWhen}
            mode={editPicker}
            is24Hour
            maximumDate={new Date()}
            onChange={(event, selected) => {
              const which = editPicker;
              setEditPicker(null);
              if (event.type === 'dismissed' || !selected) return;
              const next = new Date(mWhen);
              if (which === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              setMWhen(next);
            }}
          />
        )}
      </Modal>

      {/* 다음날 컨디션 기록/수정 시트 (기록 상세에서 진입) */}
      <MorningCheckSheet
        record={condTarget}
        onSave={(id, log) => {
          setMorningLog(id, log);
          setCondTarget(null);
        }}
        onClose={() => setCondTarget(null)}
      />
    </View>
  );
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 목표 진행률 한 줄 (라벨 + 값 + 진행 바). 달성 시 초록·체크, 상한 초과 시 overColor.
function GoalRow({ label, value, ratio, met, overColor, styles, c }: {
  label: string;
  value: string;
  ratio: number;
  met: boolean;
  overColor?: string;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  const over = ratio > 1;
  const fill = met ? c.green : over && overColor ? overColor : c.blue;
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalRowTop}>
        <Text style={styles.goalRowLabel}>{label}</Text>
        <View style={styles.goalRowRight}>
          <Text style={[styles.goalRowValue, met && { color: c.green }, over && !!overColor && { color: overColor }]}>{value}</Text>
          {met && <Ionicons name="checkmark-circle" size={16} color={c.green} />}
        </View>
      </View>
      <View style={styles.goalTrack}>
        <View style={[styles.goalFill, { width: `${pct}%`, backgroundColor: fill }]} />
      </View>
    </View>
  );
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
  morningLead: { fontSize: 14, color: c.text, lineHeight: 21 },
  morningBox: { backgroundColor: c.cardAlt, borderRadius: radius.sm, padding: 12, marginTop: 10, gap: 2 },
  morningBoxText: { fontSize: 14, color: c.text },
  morningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.blue,
  },
  morningBtnText: { fontSize: 15, fontWeight: '600', color: c.blue },
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
  mChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  mChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border },
  mChipOn: { backgroundColor: c.blue, borderColor: c.blue },
  mChipText: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
  mChipTextOn: { color: '#fff' },
  mInput: { borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, color: c.text, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  mScroll: { flexShrink: 1 },
  mSubLabel: { fontSize: 12, color: c.textFaint, marginTop: 8, marginBottom: 2 },
  mSentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 },
  mSentenceText: { fontSize: 18, color: c.text, fontWeight: '600' },
  mStepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, overflow: 'hidden' },
  mStepBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.cardAlt },
  mStepBtnText: { fontSize: 22, color: c.blue, fontWeight: '800' },
  mCountInput: { minWidth: 56, color: c.text, fontSize: 22, fontWeight: '800', paddingVertical: 6, paddingHorizontal: 4 },
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
  goalCard: { backgroundColor: c.card, borderRadius: radius.md, padding: 14, gap: 12, borderWidth: 1, borderColor: c.border },
  goalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTitle: { fontSize: 15, fontWeight: '800', color: c.text },
  goalStreak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalStreakText: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  goalHint: { fontSize: 13, color: c.textMuted },
  goalRow: { gap: 6 },
  goalRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalRowLabel: { fontSize: 14, color: c.text, fontWeight: '600' },
  goalRowRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  goalRowValue: { fontSize: 14, color: c.textMuted, fontWeight: '700' },
  goalTrack: { height: 8, borderRadius: 4, backgroundColor: c.cardAlt, overflow: 'hidden' },
  goalFill: { height: '100%', borderRadius: 4 },
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
  eqRow: { gap: 6 },
  eqLead: { fontSize: 14, color: c.text, fontWeight: '600' },
  eqChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  eqChip: { backgroundColor: c.cardAlt, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  eqChipText: { fontSize: 14, color: c.text, fontWeight: '700' },
  typeStatRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeStatName: { width: 40, fontSize: 14, color: c.text, fontWeight: '600' },
  typeStatTrack: { flex: 1, height: 10, backgroundColor: c.cardAlt, borderRadius: 5, overflow: 'hidden' },
  typeStatFill: { height: '100%', backgroundColor: c.blue, borderRadius: 5 },
  typeStatNum: { width: 52, textAlign: 'right', fontSize: 13, color: c.textMuted },
  reportRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statRowValue: { fontSize: 16, fontWeight: '700', color: c.text },
  reportVal: { fontSize: 14, color: c.text, fontWeight: '600' },
  dryHero: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginVertical: 2 },
  dryHeroNum: { fontSize: 36, fontWeight: '800', color: c.green },
  dryHeroUnit: { fontSize: 15, fontWeight: '600', color: c.textMuted },
  recapBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: c.blue, paddingVertical: 13, borderRadius: radius.md },
  recapBtnText: { fontSize: 15, color: '#fff', fontWeight: '700' },
  recapBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
  recapCard: { borderRadius: 20, padding: 22, gap: 4, overflow: 'hidden', position: 'relative' },
  recapBlob1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.13)', top: -55, right: -40 },
  recapBlob2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.10)', bottom: -45, left: -30 },
  recapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recapBrand: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '800', letterSpacing: 0.3 },
  recapCardTitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '700' },
  recapVerdictLabel: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 1, marginTop: 14 },
  recapVerdictTitle: { fontSize: 28, color: '#fff', fontWeight: '800', marginBottom: 2 },
  recapDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 8 },
  recapHero: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 2 },
  recapHeroNum: { fontSize: 48, fontWeight: '800', color: '#fff' },
  recapHeroUnit: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
  recapDelta: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginLeft: 'auto' },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  recapRowLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  recapRowValue: { fontSize: 15, color: '#fff', fontWeight: '700' },
  recapEmpty: { fontSize: 15, color: '#fff', fontWeight: '600', paddingVertical: 8 },
  recapShot: { borderRadius: 20, overflow: 'hidden' },
  recapActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  recapCloseBtn: { flex: 1, backgroundColor: c.cardAlt, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center' },
  recapShareBtn: { flex: 1, flexDirection: 'row', gap: 6, backgroundColor: c.blue, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  recapShareText: { fontSize: 15, color: '#fff', fontWeight: '700' },
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

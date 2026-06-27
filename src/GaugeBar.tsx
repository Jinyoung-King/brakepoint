import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { GaugeStyle } from './storage';
import { radius, type Palette } from './theme';

type Props = {
  style: GaugeStyle;
  count: number;
  limit: number;
  pct: number; // 0..1
  effPercents: number[]; // 브레이크 임계값(%)
  brakeCounts: number[]; // 브레이크 임계값을 잔수로 환산
  inBrake: boolean;
  overLimit: boolean;
  c: Palette;
};

// 현재 취기 단계 색: 안전(초록) → 브레이크(주황) → 초과(빨강)
function zoneColor(c: Palette, inBrake: boolean, overLimit: boolean): string {
  if (overLimit) return c.red;
  if (inBrake) return c.amber;
  return c.green;
}

export default function GaugeBar(props: Props) {
  switch (props.style) {
    case 'hp':
      return <HpBar {...props} />;
    case 'hearts':
      return <Hearts {...props} />;
    case 'boss':
      return <BossBar {...props} />;
    default:
      return <Classic {...props} />;
  }
}

// 기존 기본 바 (파랑 → 초과 시 빨강 + 임계 세로선)
function Classic({ pct, effPercents, inBrake, c }: Props) {
  const s = makeStyles(c);
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${pct * 100}%` }, inBrake && { backgroundColor: c.red }]} />
      {effPercents.map((p) => (
        <View key={p} style={[s.thresholdLine, { left: `${Math.min(p, 100)}%` }]} />
      ))}
    </View>
  );
}

// 칸 분할 체력바. 칸마다 위치에 따라 초록→노랑→빨강, 브레이크 칸은 주황 테두리.
function HpBar({ count, limit, brakeCounts, c }: Props) {
  const s = makeStyles(c);
  if (limit <= 0) return <View style={s.track} />;
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : limit;
  const cells = [];
  for (let i = 1; i <= limit; i++) {
    const filled = i <= count;
    const isBrake = brakeCounts.includes(i);
    let bg = c.track;
    if (filled) bg = i >= limit ? c.red : i >= firstBrake ? c.amber : c.green;
    cells.push(
      <View
        key={i}
        style={[
          s.hpCell,
          { backgroundColor: bg },
          isBrake && { borderColor: c.amber, borderWidth: 2 },
        ]}
      />
    );
  }
  const over = Math.max(0, count - limit);
  return (
    <View style={s.hpRow}>
      <View style={s.hpCells}>{cells}</View>
      {over > 0 && <Text style={s.hpOver}>+{over}</Text>}
    </View>
  );
}

// 하트 게이지. 한 하트 = 1잔, 마신 만큼 빨강, 초과분은 깨진 하트.
function Hearts({ count, limit }: Props) {
  if (limit <= 0) return <View style={{ height: 26 }} />;
  const hearts = [];
  for (let i = 1; i <= limit; i++) hearts.push(i <= count ? '❤️' : '🤍');
  const over = Math.max(0, count - limit);
  for (let i = 0; i < over; i++) hearts.push('💔');
  return (
    <View style={styles.heartRow}>
      {hearts.map((h, i) => (
        <Text key={i} style={styles.heart}>
          {h}
        </Text>
      ))}
    </View>
  );
}

// 격투/RPG 보스 체력바. 글로시 단색 + 라벨, 초과 시 깜빡임.
function BossBar({ pct, count, limit, inBrake, overLimit, c }: Props) {
  const s = makeStyles(c);
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!overLimit) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 450, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [overLimit, blink]);

  const fillColor = zoneColor(c, inBrake, overLimit);
  return (
    <View style={s.bossWrap}>
      <View style={s.bossLabels}>
        <Text style={s.bossName}>나</Text>
        <Text style={s.bossHp}>
          {Math.min(count, limit)} / {limit}
          {count > limit ? ` (+${count - limit})` : ''}
        </Text>
      </View>
      <View style={s.bossTrack}>
        <Animated.View style={[s.bossFill, { width: `${pct * 100}%`, backgroundColor: fillColor, opacity: blink }]}>
          <View style={s.bossGloss} />
        </Animated.View>
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    // classic
    track: {
      width: '100%',
      height: 22,
      backgroundColor: c.track,
      borderRadius: 11,
      overflow: 'hidden',
      position: 'relative',
    },
    fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: c.blue, borderRadius: 11 },
    thresholdLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: c.text, opacity: 0.55 },
    // hp
    hpRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
    hpCells: { flex: 1, flexDirection: 'row', gap: 3 },
    hpCell: { flex: 1, height: 22, borderRadius: 4, backgroundColor: c.track },
    hpOver: { fontSize: 15, fontWeight: '800', color: c.red },
    // boss
    bossWrap: { width: '100%', gap: 4 },
    bossLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    bossName: { fontSize: 12, fontWeight: '800', color: c.text, letterSpacing: 1 },
    bossHp: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    bossTrack: {
      width: '100%',
      height: 18,
      backgroundColor: c.track,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: c.text,
      overflow: 'hidden',
    },
    bossFill: { height: '100%', borderRadius: 2 },
    bossGloss: { height: '45%', backgroundColor: '#fff', opacity: 0.25, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  });

// 색 팔레트와 무관한 정적 스타일
const styles = StyleSheet.create({
  heartRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  heart: { fontSize: 24 },
});

import { useEffect, useRef, useState } from 'react';
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
// 반잔(0.5)은 해당 칸을 부분 채움으로 표시.
function HpBar({ count, limit, brakeCounts, c }: Props) {
  const s = makeStyles(c);
  if (limit <= 0) return <View style={s.track} />;
  const firstBrake = brakeCounts.length ? Math.min(...brakeCounts) : limit;
  const colorAt = (i: number) => (i >= limit ? c.red : i >= firstBrake ? c.amber : c.green);
  const full = Math.floor(count);
  const frac = count - full;
  const cells = [];
  for (let i = 1; i <= limit; i++) {
    const isBrake = brakeCounts.includes(i);
    const isPartial = i === full + 1 && frac > 0;
    cells.push(
      <View
        key={i}
        style={[
          s.hpCell,
          { backgroundColor: i <= full ? colorAt(i) : c.track },
          isBrake && { borderColor: c.amber, borderWidth: 2 },
        ]}
      >
        {isPartial && (
          <View style={[s.hpPartial, { width: `${frac * 100}%`, backgroundColor: colorAt(i) }]} />
        )}
      </View>
    );
  }
  const over = Math.max(0, count - limit);
  return (
    <View style={s.hpRow}>
      <View style={s.hpCells}>{cells}</View>
      {over > 0 && <Text style={s.hpOver}>+{over % 1 === 0 ? over : over.toFixed(1)}</Text>}
    </View>
  );
}

// 하트 게이지. 한 하트 = 1잔, 마신 만큼 빨강, 반잔은 반투명 하트, 초과분은 깨진 하트.
// 한도가 커도 항상 한 줄에 들어가도록 폭을 측정해 하트 크기를 자동 조절한다.
function Hearts({ count, limit }: Props) {
  const [rowW, setRowW] = useState(0);
  if (limit <= 0) return <View style={{ height: 26 }} />;
  const full = Math.floor(count);
  const frac = count - full;
  const tokens: ('full' | 'half' | 'empty')[] = [];
  for (let i = 1; i <= limit; i++) {
    if (i <= full) tokens.push('full');
    else if (i === full + 1 && frac > 0) tokens.push('half');
    else tokens.push('empty');
  }
  const broken = Math.floor(Math.max(0, count - limit));
  const n = limit + broken;
  const gap = 4;
  // 글리프 가로폭 ≈ fontSize*1.15. 폭 안에 n개가 한 줄로 들어가도록 크기 산출.
  const size = rowW > 0 ? Math.max(12, Math.min(26, (rowW - gap * (n - 1)) / n / 1.15)) : 22;
  const heartStyle = { fontSize: size, lineHeight: Math.round(size * 1.3) };
  return (
    <View style={styles.heartRow} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {tokens.map((t, i) => (
        <Text key={i} style={[heartStyle, t === 'half' && styles.heartHalf]}>
          {t === 'empty' ? '🤍' : '❤️'}
        </Text>
      ))}
      {Array.from({ length: broken }, (_, i) => (
        <Text key={`b${i}`} style={heartStyle}>
          💔
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
    hpCell: { flex: 1, height: 22, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' },
    hpPartial: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
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
  heartRow: { width: '100%', flexDirection: 'row', gap: 4, justifyContent: 'center', alignItems: 'center' },
  heartHalf: { opacity: 0.4 },
});

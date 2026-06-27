import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import type { GaugeStyle } from './storage';
import { radius, type Palette } from './theme';

// HP바 전용 8비트 레트로 팔레트 (테마와 무관하게 고정 — 게임 화면 느낌)
const RETRO = { green: '#3ae62a', yellow: '#ffd23d', red: '#ff3b3b', empty: '#191c22' };
const DOTS_PER_DRINK = 4; // 잔당 LED 도트 수 (0.25 = 도트 1칸)

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
  const colorAt = (i: number) => (i >= limit ? RETRO.red : i >= firstBrake ? RETRO.yellow : RETRO.green);
  // 잔마다 그룹, 그룹은 DOTS_PER_DRINK개의 LED 도트로 분할(잔당 0.25 단위로 점등).
  const groups = [];
  for (let i = 1; i <= limit; i++) {
    const isBrake = brakeCounts.includes(i);
    const dots = [];
    for (let d = 0; d < DOTS_PER_DRINK; d++) {
      const threshold = i - 1 + (d + 1) / DOTS_PER_DRINK;
      const lit = count >= threshold - 1e-9;
      dots.push(<View key={d} style={s.hpDot}>{lit && <PixelBlock color={colorAt(i)} />}</View>);
    }
    groups.push(
      <View key={i} style={[s.hpGroup, isBrake && s.hpGroupBrake]}>
        {dots}
      </View>
    );
  }
  const over = Math.max(0, count - limit);
  return (
    <View style={s.hpRow}>
      <View style={s.hpFrame}>
        <View style={s.hpCells}>{groups}</View>
      </View>
      {over > 0 && <Text style={s.hpOver}>+{over}</Text>}
    </View>
  );
}

// 청키한 픽셀 블록: 단색 위에 상단 하이라이트 + 하단 그림자(각진 모서리, 베벨 느낌).
function PixelBlock({ color }: { color: string }) {
  return (
    <View style={[pixel.block, { backgroundColor: color }]}>
      <View style={pixel.hi} />
      <View style={pixel.lo} />
    </View>
  );
}

const pixel = StyleSheet.create({
  block: { flex: 1, height: '100%' },
  hi: { height: '32%', backgroundColor: '#fff', opacity: 0.3 },
  lo: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '26%', backgroundColor: '#000', opacity: 0.22 },
});

// 하트 게이지(벡터 아이콘). 한 하트 = 1잔, 마신 만큼 빨강, 반잔은 반하트, 초과분은 깨진 하트.
// 한도가 커도 항상 한 줄에 들어가도록 폭을 측정해 아이콘 크기를 자동 조절한다.
function Hearts({ count, limit, c }: Props) {
  const [rowW, setRowW] = useState(0);
  if (limit <= 0) return <View style={{ height: 28 }} />;
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
  const gap = 6;
  // 아이콘은 거의 정사각형(가로폭 ≈ size). n개가 한 줄에 들어가게 크기 산출.
  const size = rowW > 0 ? Math.round(Math.max(16, Math.min(30, (rowW - gap * (n - 1)) / n))) : 24;
  return (
    <View style={[styles.heartRow, { gap }]} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {tokens.map((t, i) =>
        t === 'full' ? (
          <Ionicons key={i} name="heart" size={size} color={c.red} />
        ) : t === 'half' ? (
          <Ionicons key={i} name="heart-half" size={size} color={c.red} />
        ) : (
          <Ionicons key={i} name="heart-outline" size={size} color={c.textFaint} />
        )
      )}
      {Array.from({ length: broken }, (_, i) => (
        <MaterialCommunityIcons key={`b${i}`} name="heart-broken" size={size} color={c.red} />
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
    // hp (픽셀/레트로): 두꺼운 각진 프레임 + 격자 칸 + 청키 블록
    hpRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
    hpFrame: {
      flex: 1,
      borderWidth: 3,
      borderColor: c.text,
      backgroundColor: c.track,
      padding: 2,
    },
    hpCells: { flex: 1, flexDirection: 'row', gap: 3, height: 22 },
    hpGroup: { flex: 1, flexDirection: 'row', gap: 1 },
    hpGroupBrake: { borderWidth: 2, borderColor: c.text },
    hpDot: { flex: 1, height: '100%', backgroundColor: RETRO.empty, overflow: 'hidden' },
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
  heartRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});

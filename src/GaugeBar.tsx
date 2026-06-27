import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { isLoaded as isFontLoaded } from 'expo-font';

import type { GaugeStyle } from './storage';
import { PIXEL_FONT } from './fonts';
import { radius, type Palette } from './theme';

// 숫자 표시에 픽셀 폰트(로드됐을 때만). Press Start 2P는 라틴/숫자 전용.
const pixelText = () => (isFontLoaded(PIXEL_FONT) ? { fontFamily: PIXEL_FONT } : null);

// HP/보스 전용 8비트 레트로 팔레트 (테마와 무관하게 고정 — 게임 화면 느낌)
const RETRO = { green: '#3ae62a', yellow: '#ffd23d', red: '#ff3b3b', empty: '#191c22' };
const MP = { blue: '#2f7ff0', glow: '#7fd0ff', empty: '#101f38', edge: '#2a4a7a' };
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

export default function GaugeBar(props: Props) {
  switch (props.style) {
    case 'hp':
      return <HpBar {...props} />;
    case 'hearts':
      return <Hearts {...props} />;
    case 'boss':
      return <BossBar {...props} />;
    case 'mp':
      return <MpBar {...props} />;
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
function HpBar({ count, limit, brakeCounts, inBrake, overLimit, c }: Props) {
  const s = makeStyles(c);
  if (limit <= 0) return <View style={s.track} />;
  // 남은 HP가 왼쪽부터 점등되고, 마실수록 오른쪽부터 꺼진다(보스처럼 감소).
  // 색은 현재 위험도에 따라 통일: 안전 초록 → 브레이크 노랑 → 초과 빨강.
  const litDots = Math.round(Math.max(0, limit - count) * DOTS_PER_DRINK);
  const color = overLimit ? RETRO.red : inBrake ? RETRO.yellow : RETRO.green;
  let g = 0;
  const groups = [];
  for (let i = 1; i <= limit; i++) {
    const isBrake = brakeCounts.includes(i);
    const dots = [];
    for (let d = 0; d < DOTS_PER_DRINK; d++) {
      const lit = g < litDots;
      g += 1;
      dots.push(<View key={d} style={s.hpDot}>{lit && <PixelBlock color={color} />}</View>);
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
      <View style={[s.hpFrame, overLimit && { borderColor: RETRO.red }]}>
        <View style={s.hpCells}>{groups}</View>
      </View>
      {over > 0 && <Text style={[s.hpOver, pixelText() && s.hpOverPixel]}>+{over}</Text>}
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

// 하트 게이지(벡터 아이콘). 한 하트 = 1잔, 마신 만큼 빨강, 부분잔(0.25 단위)은
// 빈 하트 위에 채운 하트를 비율만큼 잘라 겹쳐 정확히 표시, 초과분은 깨진 하트.
// 한도가 커도 항상 한 줄에 들어가도록 폭을 측정해 아이콘 크기를 자동 조절한다.
function Hearts({ count, limit, c }: Props) {
  const [rowW, setRowW] = useState(0);
  if (limit <= 0) return <View style={{ height: 28 }} />;
  // 남은 하트(빨강)가 마실수록 오른쪽부터 줄어든다(HP/보스처럼 감소). 0.25 단위는 부분 하트.
  const remaining = Math.max(0, limit - count);
  const fullHearts = Math.floor(remaining);
  const fracRem = remaining - fullHearts;
  const broken = Math.floor(Math.max(0, count - limit));
  const n = limit + broken;
  const gap = 6;
  // 아이콘은 거의 정사각형(가로폭 ≈ size). n개가 한 줄에 들어가게 크기 산출.
  const size = rowW > 0 ? Math.round(Math.max(16, Math.min(30, (rowW - gap * (n - 1)) / n))) : 24;
  const items = [];
  for (let i = 1; i <= limit; i++) {
    if (i <= fullHearts) items.push(<Ionicons key={i} name="heart" size={size} color={c.red} />);
    else if (i === fullHearts + 1 && fracRem > 0)
      items.push(<PartialHeart key={i} size={size} frac={fracRem} c={c} />);
    else items.push(<Ionicons key={i} name="heart-outline" size={size} color={c.textFaint} />);
  }
  for (let i = 0; i < broken; i++)
    items.push(<MaterialCommunityIcons key={`b${i}`} name="heart-broken" size={size} color={c.red} />);
  return (
    <View style={[styles.heartRow, { gap }]} onLayout={(e) => setRowW(e.nativeEvent.layout.width)}>
      {items}
    </View>
  );
}

// 부분 하트: 빈 하트 위에 채운 하트를 frac 비율(가로)만큼 잘라 겹친다(정확한 0.25 등).
function PartialHeart({ size, frac, c }: { size: number; frac: number; c: Palette }) {
  return (
    <View style={{ width: size, height: size }}>
      <Ionicons name="heart-outline" size={size} color={c.textFaint} style={{ position: 'absolute', left: 0, top: 0 }} />
      <View style={{ position: 'absolute', left: 0, top: 0, height: size, width: size * frac, overflow: 'hidden' }}>
        <Ionicons name="heart" size={size} color={c.red} />
      </View>
    </View>
  );
}

// 보스 체력바: 한계를 보스로 보고 취기가 찰수록 오른쪽부터 깎인다(=보스 HP 감소).
// 픽셀 프레임 + BOSS 라벨, 한계 도달(보스 처치) 시 빨강으로 깜빡.
function BossBar({ count, limit, inBrake, overLimit, c }: Props) {
  const s = makeStyles(c);
  const pf = pixelText();
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!overLimit) {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.3, duration: 420, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 420, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [overLimit, blink]);

  const remaining = limit > 0 ? Math.max(0, Math.min(1, (limit - count) / limit)) : 0;
  const fillW = overLimit ? 1 : remaining; // 초과(보스 처치)면 빨강 전체 + 깜빡
  const fillColor = overLimit ? RETRO.red : inBrake ? RETRO.yellow : RETRO.green;
  return (
    <View style={s.bossWrap}>
      <View style={s.bossLabels}>
        <Text style={[s.bossName, pf && s.bossNamePixel]}>BOSS</Text>
        <Text style={[s.bossHp, pf && s.bossHpPixel]}>
          {Math.min(count, limit)} / {limit}
          {count > limit ? ` (+${count - limit})` : ''}
        </Text>
      </View>
      <View style={s.hpFrame}>
        <View style={s.bossTrack}>
          <Animated.View style={[s.bossFill, { width: `${fillW * 100}%`, backgroundColor: fillColor, opacity: blink }]}>
            <View style={s.bossGloss} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// MP(마나) 바: 파란 마나가 취기만큼 차오른다. 매끈한 둥근 글로시 + 마나 눈금.
// MP(마나) 바: 마실수록 남은 마나가 감소(보스처럼). 매끈한 둥근 글로시 블루 + 눈금.
function MpBar({ count, limit, c }: Props) {
  const s = makeStyles(c);
  const pf = pixelText();
  const ticks = Math.max(0, Math.ceil(limit) - 1);
  const remaining = limit > 0 ? Math.max(0, Math.min(1, (limit - count) / limit)) : 0;
  return (
    <View style={s.bossWrap}>
      <View style={s.bossLabels}>
        <Text style={[s.mpName, pf && s.mpNamePixel]}>MP</Text>
        <Text style={[s.bossHp, pf && s.bossHpPixel]}>
          {Math.min(count, limit)} / {limit}
          {count > limit ? ` (+${count - limit})` : ''}
        </Text>
      </View>
      <View style={s.mpTrack}>
        <View style={[s.mpFill, { width: `${remaining * 100}%` }]}>
          <View style={s.mpGloss} />
        </View>
        {limit > 0 &&
          Array.from({ length: ticks }, (_, i) => (
            <View key={i} style={[s.mpTick, { left: `${((i + 1) / limit) * 100}%` }]} />
          ))}
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
      // flexGrow로 폭만 채우고 높이는 콘텐츠대로(flexBasis auto) — flex:1이면 콘텐츠
      // 높이 컨테이너(모달 등)에서 높이가 0으로 접힘.
      flexGrow: 1,
      flexBasis: 'auto',
      borderWidth: 3,
      borderColor: c.text,
      backgroundColor: c.track,
      padding: 2,
    },
    hpCells: { width: '100%', flexDirection: 'row', gap: 3, height: 22 },
    hpGroup: { flex: 1, flexDirection: 'row', gap: 1 },
    hpGroupBrake: { borderWidth: 2, borderColor: c.text },
    hpDot: { flex: 1, height: '100%', backgroundColor: RETRO.empty, overflow: 'hidden' },
    hpOver: { fontSize: 15, fontWeight: '800', color: c.red },
    hpOverPixel: { fontFamily: PIXEL_FONT, fontSize: 12, fontWeight: '400' },
    // boss
    bossWrap: { width: '100%', gap: 4 },
    bossLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    bossName: { fontSize: 12, fontWeight: '800', color: c.text, letterSpacing: 1 },
    bossNamePixel: { fontFamily: PIXEL_FONT, fontSize: 10, fontWeight: '400', color: RETRO.red },
    bossHp: { fontSize: 12, fontWeight: '700', color: c.textMuted },
    bossHpPixel: { fontFamily: PIXEL_FONT, fontSize: 9, fontWeight: '400' },
    // 보스 트랙(픽셀 프레임 hpFrame 안에 들어감) — 각진 다크 트랙
    bossTrack: { width: '100%', height: 22, backgroundColor: RETRO.empty, overflow: 'hidden' },
    bossFill: { height: '100%' },
    bossGloss: { height: '40%', backgroundColor: '#fff', opacity: 0.28 },
    // MP(마나) 바 — 매끈한 둥근 글로시 블루
    mpName: { fontSize: 12, fontWeight: '800', color: MP.glow, letterSpacing: 1 },
    mpNamePixel: { fontFamily: PIXEL_FONT, fontSize: 10, fontWeight: '400', color: MP.glow },
    mpTrack: {
      width: '100%',
      height: 18,
      backgroundColor: MP.empty,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: MP.edge,
      overflow: 'hidden',
    },
    mpFill: { height: '100%', backgroundColor: MP.blue, borderRadius: 9 },
    mpGloss: { height: '45%', backgroundColor: '#fff', opacity: 0.3, borderTopLeftRadius: 9, borderTopRightRadius: 9 },
    mpTick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: '#0a1830', opacity: 0.6 },
  });

// 색 팔레트와 무관한 정적 스타일
const styles = StyleSheet.create({
  heartRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});

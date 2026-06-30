import { View, Text, StyleSheet } from 'react-native';

import type { Palette } from './theme';

// 취기%에 따라 표정이 바뀌는 얼굴 캐릭터 (이모지 X, 순수 View로 그림).
// 0 멀쩡 → 1 기분 좋음 → 2 알딸딸 → 3 위험. 얼굴색·볼터치·눈·입이 단계별로 변한다.
const HEAD = 96;
const HEAD_COLORS = ['#cfd8e3', '#ffd9b0', '#ffb38f', '#ff8a7a'];
const BLUSH_OPACITY = [0, 0.35, 0.6, 0.85];
const LABELS = ['멀쩡', '기분 좋음', '알딸딸', '위험'];

type Props = { pct: number; overLimit: boolean; c: Palette };

export default function TipsyFace({ pct, overLimit, c }: Props) {
  const stage = overLimit ? 3 : pct >= 0.6 ? 2 : pct >= 0.25 ? 1 : 0;

  const Eye = ({ left }: { left: number }) => {
    if (stage === 3) {
      // X 눈
      return (
        <View style={[s.eyeBox, { left }]}>
          <View style={[s.xBar, { transform: [{ rotate: '45deg' }] }]} />
          <View style={[s.xBar, { transform: [{ rotate: '-45deg' }] }]} />
        </View>
      );
    }
    if (stage === 2) return <View style={[s.eyeHalf, { left }]} />; // 반쯤 풀린 눈
    return <View style={[s.eyeDot, { left }]} />;
  };

  const mouth =
    stage === 0 ? (
      <View style={s.mouthFlat} />
    ) : stage === 3 ? (
      <View style={s.mouthOpen} />
    ) : (
      <View style={[s.mouthSmile, stage === 2 && s.mouthSmileBig]} />
    );

  return (
    <View style={s.wrap}>
      <View style={[s.head, { backgroundColor: HEAD_COLORS[stage] }]}>
        <View style={[s.blush, s.blushL, { opacity: BLUSH_OPACITY[stage] }]} />
        <View style={[s.blush, s.blushR, { opacity: BLUSH_OPACITY[stage] }]} />
        <Eye left={24} />
        <Eye left={HEAD - 24 - 14} />
        {mouth}
        {stage >= 2 && <View style={s.sweat} />}
      </View>
      <Text style={[s.label, { color: stage >= 3 ? c.red : c.textMuted }]}>취기 · {LABELS[stage]}</Text>
    </View>
  );
}

const INK = '#2b2b33';
const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  head: { width: HEAD, height: HEAD, borderRadius: HEAD / 2, position: 'relative', overflow: 'hidden' },
  eyeDot: { position: 'absolute', top: 36, width: 11, height: 11, borderRadius: 6, backgroundColor: INK },
  eyeHalf: { position: 'absolute', top: 40, width: 14, height: 5, borderRadius: 3, backgroundColor: INK },
  eyeBox: { position: 'absolute', top: 32, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  xBar: { position: 'absolute', width: 16, height: 3, borderRadius: 2, backgroundColor: INK },
  blush: { position: 'absolute', top: 54, width: 18, height: 11, borderRadius: 9, backgroundColor: '#ff5a7a' },
  blushL: { left: 16 },
  blushR: { right: 16 },
  mouthFlat: { position: 'absolute', top: 66, alignSelf: 'center', left: HEAD / 2 - 9, width: 18, height: 3, borderRadius: 2, backgroundColor: INK },
  mouthSmile: { position: 'absolute', top: 60, left: HEAD / 2 - 11, width: 22, height: 11, borderWidth: 3, borderTopWidth: 0, borderColor: INK, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  mouthSmileBig: { top: 58, left: HEAD / 2 - 15, width: 30, height: 15, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  mouthOpen: { position: 'absolute', top: 60, left: HEAD / 2 - 9, width: 18, height: 15, borderRadius: 9, backgroundColor: INK },
  sweat: { position: 'absolute', top: 20, right: 18, width: 7, height: 11, borderRadius: 5, borderTopLeftRadius: 1, backgroundColor: '#4db6ff' },
  label: { fontSize: 13, fontWeight: '700' },
});

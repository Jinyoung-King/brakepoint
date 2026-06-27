import { useState } from 'react';
import { View, Text, StyleSheet, type GestureResponderEvent } from 'react-native';

import type { BacPoint } from './bac';
import type { Palette } from './theme';

const fmtClock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// SVG 없이 순수 View로 그리는 BAC 시간곡선(막대형 area).
// 과거는 진하게, now 이후 예측은 흐리게. 0.03 운전가능선/"지금" 마커 +
// 잔 추가 지점(점) + 터치 시 해당 시각·BAC 툴팁.
export default function BacChart({
  points,
  nowMs,
  driveLimit,
  c,
  height = 120,
  eventTimes = [],
}: {
  points: BacPoint[];
  nowMs: number;
  driveLimit: number;
  c: Palette;
  height?: number;
  eventTimes?: number[];
}) {
  const [width, setWidth] = useState(0);
  const [tip, setTip] = useState<{ x: number; label: string } | null>(null);

  if (points.length < 2) return null;

  const t0 = points[0].t;
  const tN = points[points.length - 1].t;
  const span = Math.max(1, tN - t0);
  const maxData = points.reduce((m, p) => Math.max(m, p.bac), 0);
  const maxBac = Math.max(maxData, driveLimit * 1.5, 0.001);

  const nowFrac = Math.min(1, Math.max(0, (nowMs - t0) / span));
  const limitTop = (1 - driveLimit / maxBac) * height;

  const onTouch = (e: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = Math.min(width, Math.max(0, e.nativeEvent.locationX));
    const t = t0 + (x / width) * span;
    let nearest = points[0];
    for (const p of points) if (Math.abs(p.t - t) < Math.abs(nearest.t - t)) nearest = p;
    setTip({ x, label: `${fmtClock(nearest.t)} · ${nearest.bac.toFixed(3)}%` });
  };

  const tipLeft = Math.min(Math.max(tip ? tip.x - 55 : 0, 0), Math.max(0, width - 110));

  return (
    <View style={styles.wrap}>
      <View
        style={[styles.plot, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
      >
        {/* 0.03% 운전가능선 */}
        <View style={[styles.limitLine, { top: limitTop, borderColor: c.amber }]} pointerEvents="none" />
        {/* 막대들 */}
        <View style={[styles.bars, { height }]} pointerEvents="none">
          {points.map((p, i) => {
            const h = Math.max(1, (p.bac / maxBac) * height);
            const over = p.bac >= driveLimit;
            const projected = p.t > nowMs;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  backgroundColor: over ? c.red : c.green,
                  opacity: projected ? 0.3 : 1,
                  borderTopLeftRadius: 1,
                  borderTopRightRadius: 1,
                }}
              />
            );
          })}
        </View>
        {/* 잔 추가 지점 */}
        {eventTimes.map((et, i) =>
          et < t0 || et > tN ? null : (
            <View
              key={i}
              style={[styles.eventDot, { left: `${((et - t0) / span) * 100}%`, backgroundColor: c.blue }]}
              pointerEvents="none"
            />
          )
        )}
        {/* "지금" 세로 마커 */}
        {nowFrac > 0 && nowFrac < 1 && (
          <View style={[styles.nowLine, { left: `${nowFrac * 100}%`, backgroundColor: c.text }]} pointerEvents="none" />
        )}
        {/* 터치 툴팁 */}
        {tip && (
          <>
            <View style={[styles.tipLine, { left: tip.x, backgroundColor: c.text }]} pointerEvents="none" />
            <View
              style={[styles.tip, { left: tipLeft, backgroundColor: c.cardAlt, borderColor: c.border }]}
              pointerEvents="none"
            >
              <Text style={[styles.tipText, { color: c.text }]}>{tip.label}</Text>
            </View>
          </>
        )}
      </View>
      {/* x축 라벨 */}
      <View style={styles.labels}>
        <Text style={[styles.label, { color: c.textFaint }]}>{fmtClock(t0)} 시작</Text>
        <Text style={[styles.label, { color: c.amber }]}>0.03% 운전가능선</Text>
        <Text style={[styles.label, { color: c.textFaint }]}>{fmtClock(tN)} 해독</Text>
      </View>
      <Text style={[styles.hint, { color: c.textFaint }]}>● 잔 추가 · 그래프를 누르면 그 시각 BAC</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  plot: { position: 'relative', justifyContent: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  limitLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 2,
  },
  nowLine: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.5, zIndex: 3 },
  eventDot: { position: 'absolute', top: 0, width: 6, height: 6, borderRadius: 3, marginLeft: -3, zIndex: 4 },
  tipLine: { position: 'absolute', top: 0, bottom: 0, width: 1, opacity: 0.7, zIndex: 5 },
  tip: {
    position: 'absolute',
    top: -2,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    width: 110,
    alignItems: 'center',
    zIndex: 6,
  },
  tipText: { fontSize: 12, fontWeight: '600' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 11 },
  hint: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});

import { View, Text, StyleSheet } from 'react-native';

import type { BacPoint } from './bac';
import type { Palette } from './theme';

const fmtClock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// SVG 없이 순수 View로 그리는 BAC 시간곡선(막대형 area).
// 과거 구간은 진하게, now 이후 예측 구간은 흐리게. 0.03 운전가능선/"지금" 마커 표시.
export default function BacChart({
  points,
  nowMs,
  driveLimit,
  c,
  height = 120,
}: {
  points: BacPoint[];
  nowMs: number;
  driveLimit: number;
  c: Palette;
  height?: number;
}) {
  if (points.length < 2) return null;

  const t0 = points[0].t;
  const tN = points[points.length - 1].t;
  const span = Math.max(1, tN - t0);
  const maxData = points.reduce((m, p) => Math.max(m, p.bac), 0);
  // 운전가능선이 항상 보이도록 스케일 하한 확보
  const maxBac = Math.max(maxData, driveLimit * 1.5, 0.001);

  const nowFrac = Math.min(1, Math.max(0, (nowMs - t0) / span));
  const limitTop = (1 - driveLimit / maxBac) * height; // 운전가능선 y(위에서부터)

  return (
    <View style={styles.wrap}>
      <View style={[styles.plot, { height }]}>
        {/* 0.03% 운전가능선 */}
        <View
          style={[styles.limitLine, { top: limitTop, borderColor: c.amber }]}
          pointerEvents="none"
        />
        {/* 막대들 */}
        <View style={[styles.bars, { height }]}>
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
        {/* "지금" 세로 마커 */}
        {nowFrac > 0 && nowFrac < 1 && (
          <View
            style={[styles.nowLine, { left: `${nowFrac * 100}%`, backgroundColor: c.text }]}
            pointerEvents="none"
          />
        )}
      </View>
      {/* x축 라벨 */}
      <View style={styles.labels}>
        <Text style={[styles.label, { color: c.textFaint }]}>{fmtClock(t0)} 시작</Text>
        <Text style={[styles.label, { color: c.amber }]}>0.03% 운전가능선</Text>
        <Text style={[styles.label, { color: c.textFaint }]}>{fmtClock(tN)} 해독</Text>
      </View>
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
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { fontSize: 11 },
});

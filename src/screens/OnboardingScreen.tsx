import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';
import type { DrinkUnit, Sex } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const STEPS = ['주량', '브레이크', '가짜 전화'];
const UNITS: DrinkUnit[] = ['잔', '병', '캔'];
const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: '남' },
  { key: 'female', label: '여' },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { state, setLimit, setUnit, setSex, setWeightKg, setBrakePercents, updateFakeCall, completeOnboarding } =
    useAppState();
  const { limit, unit, sex, weightKg, brakePercents, fakeCall } = state;
  const insets = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [step, setStep] = useState(0);
  const [limitText, setLimitText] = useState(String(limit));
  const [weightText, setWeightText] = useState(String(weightKg));
  const [brake1Text, setBrake1Text] = useState(String(brakePercents[0] ?? 60));
  const [brake2Text, setBrake2Text] = useState(String(brakePercents[1] ?? 80));
  const [periodText, setPeriodText] = useState(String(fakeCall.periodMin));

  const commitNum = (t: string, apply: (n: number) => void, min = 1, max = 999) => {
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= min && n <= max) apply(n);
  };

  const finish = () => {
    completeOnboarding();
    navigation.replace('Home');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.dots}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.dotWrap}>
            <View style={[styles.dot, i <= step && styles.dotActive]} />
            <Text style={[styles.dotLabel, i === step && styles.dotLabelActive]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.body}>
        {step === 0 && (
          <>
            <Text style={styles.title}>오늘의 주량은?</Text>
            <Text style={styles.desc}>최대 몇 {unit}까지 마실지 정해주세요. 이 값을 기준으로 브레이크가 걸려요.</Text>
            <Text style={styles.label}>단위</Text>
            <View style={styles.segment}>
              {UNITS.map((u) => {
                const active = u === unit;
                return (
                  <Pressable
                    key={u}
                    style={[styles.segItem, active && styles.segItemActive]}
                    onPress={() => setUnit(u)}
                  >
                    <Text style={[styles.segText, active && styles.segTextActive]}>{u}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>한계 ({unit})</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={limitText}
              onChangeText={(t) => {
                setLimitText(t);
                commitNum(t, setLimit);
              }}
              placeholder="5"
              placeholderTextColor={c.textFaint}
            />
            <Text style={styles.label}>성별 · 체중 (혈중알코올 추정용)</Text>
            <View style={styles.row}>
              <View style={[styles.segment, { flex: 1 }]}>
                {SEXES.map((sx) => {
                  const on = sx.key === sex;
                  return (
                    <Pressable
                      key={sx.key}
                      style={[styles.segItem, on && styles.segItemActive]}
                      onPress={() => setSex(sx.key)}
                    >
                      <Text style={[styles.segText, on && styles.segTextActive]}>{sx.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                keyboardType="number-pad"
                value={weightText}
                onChangeText={(t) => {
                  setWeightText(t);
                  commitNum(t, setWeightKg, 30, 250);
                }}
                placeholder="체중(kg)"
                placeholderTextColor={c.textFaint}
              />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>어디서 브레이크?</Text>
            <Text style={styles.desc}>주량의 몇 %에서 인지 게이트를 띄울지 정해주세요. (두 번 걸 수 있어요)</Text>
            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>1차 (%)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={brake1Text}
                  onChangeText={(t) => {
                    setBrake1Text(t);
                    commitNum(t, (n) => setBrakePercents([n, brakePercents[1] ?? 80]), 1, 100);
                  }}
                  placeholder="60"
                />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>2차 (%)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  value={brake2Text}
                  onChangeText={(t) => {
                    setBrake2Text(t);
                    commitNum(t, (n) => setBrakePercents([brakePercents[0] ?? 60, n]), 1, 100);
                  }}
                  placeholder="80"
                />
              </View>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>가짜 전화 설정</Text>
            <Text style={styles.desc}>음주모드를 켜면 주기마다 이 발신자로 전화가 와요. (탈출 핑계용)</Text>
            <Text style={styles.label}>발신자 이름</Text>
            <TextInput
              style={styles.input}
              value={fakeCall.callerName}
              onChangeText={(t) => updateFakeCall({ callerName: t })}
              placeholder="엄마"
            />
            <Text style={styles.label}>주기 (분)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={periodText}
              onChangeText={(t) => {
                setPeriodText(t);
                commitNum(t, (n) => updateFakeCall({ periodMin: n }));
              }}
              placeholder="45"
            />
          </>
        )}
      </View>

      <View style={styles.nav}>
        {step > 0 ? (
          <Pressable onPress={() => setStep((s) => s - 1)} hitSlop={8}>
            <Text style={styles.back}>이전</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {step < STEPS.length - 1 ? (
          <Pressable style={styles.nextBtn} onPress={() => setStep((s) => s + 1)}>
            <Text style={styles.nextText}>다음</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.nextBtn} onPress={finish}>
            <Text style={styles.nextText}>시작하기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, backgroundColor: c.bg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 8 },
  dotWrap: { alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
  dotActive: { backgroundColor: c.blue },
  dotLabel: { fontSize: 12, color: c.textFaint },
  dotLabelActive: { color: c.blue, fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: c.text },
  desc: { fontSize: 15, color: c.textMuted, lineHeight: 21, marginBottom: 8 },
  label: { fontSize: 13, color: c.textMuted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    color: c.text,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
  },
  segment: { flexDirection: 'row', gap: 8 },
  segItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    alignItems: 'center',
  },
  segItemActive: { backgroundColor: c.blue, borderColor: c.blue },
  segText: { fontSize: 16, color: c.textMuted },
  segTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 6 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, color: c.textMuted },
  nextBtn: { backgroundColor: c.blue, paddingVertical: 14, paddingHorizontal: 32, borderRadius: radius.md },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const STEPS = ['주량', '브레이크', '가짜 전화'];

export default function OnboardingScreen({ navigation }: Props) {
  const { state, setLimit, setBrakePercents, updateFakeCall, completeOnboarding } = useAppState();
  const { limit, brakePercents, fakeCall } = state;
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [limitText, setLimitText] = useState(String(limit));
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
            <Text style={styles.desc}>최대 몇 잔까지 마실지 정해주세요. 이 값을 기준으로 브레이크가 걸려요.</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={limitText}
              onChangeText={(t) => {
                setLimitText(t);
                commitNum(t, setLimit);
              }}
              placeholder="5"
              autoFocus
            />
            <Text style={styles.unit}>잔</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, backgroundColor: '#fff' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 8 },
  dotWrap: { alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ddd' },
  dotActive: { backgroundColor: '#3a7afe' },
  dotLabel: { fontSize: 12, color: '#bbb' },
  dotLabelActive: { color: '#3a7afe', fontWeight: '600' },
  body: { flex: 1, justifyContent: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#222' },
  desc: { fontSize: 15, color: '#777', lineHeight: 21, marginBottom: 8 },
  label: { fontSize: 14, color: '#666' },
  unit: { fontSize: 14, color: '#999' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
  },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1, gap: 6 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { fontSize: 16, color: '#888' },
  nextBtn: { backgroundColor: '#222', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

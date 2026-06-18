import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';
import { gen4Digit, genMath, revealMs, type MathProblem } from '../gate/problems';

type Props = NativeStackScreenProps<RootStackParamList, 'CognitiveGate'>;

const VIBRATION_PATTERN = [0, 600, 400];

export default function CognitiveGateScreen({ navigation }: Props) {
  const { state } = useAppState();
  const { difficulty } = state;

  const player = useAudioPlayer(require('../../assets/alarm.wav'));

  // 한 번에 한 문제씩: 숫자노출 → 4자리 입력 → 산수
  const [phase, setPhase] = useState<'reveal' | 'recall' | 'math'>('reveal');
  const [secret, setSecret] = useState('');
  const [math, setMath] = useState<MathProblem>({ text: '', answer: 0 });
  const [mathInput, setMathInput] = useState('');
  const [recallInput, setRecallInput] = useState('');
  const [wrong, setWrong] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 새 라운드 시작: 문제 생성 후 숫자 노출 → 일정 시간 뒤 입력 단계
  const newRound = useCallback(() => {
    setSecret(gen4Digit());
    setMath(genMath(difficulty));
    setMathInput('');
    setRecallInput('');
    setPhase('reveal');
    if (revealTimer.current) clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => setPhase('recall'), revealMs(difficulty));
  }, [difficulty]);

  // 알람 시작 (소리 루프 + 진동), 화면 떠날 때 정리
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.loop = true;
    player.volume = 1.0;
    player.play();
    Vibration.vibrate(VIBRATION_PATTERN, true);
    newRound();
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
      Vibration.cancel();
      player.pause();
    };
    // player/newRound는 마운트 시 고정. 마운트당 1회만 실행.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 통과 전까지 안드 뒤로가기 차단
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // 1단계: 4자리 기억. 맞으면 산수로, 틀리면 처음부터.
  const submitRecall = (recallVal: string) => {
    if (recallVal.trim() === secret) {
      setWrong(false);
      setPhase('math');
    } else {
      setWrong(true);
      newRound();
    }
  };
  const onRecallChange = (t: string) => {
    setRecallInput(t);
    if (t.length === 4) submitRecall(t);
  };

  // 2단계: 산수. 맞으면 해제, 틀리면 처음부터.
  const submitMath = (mathVal: string) => {
    if (mathVal.trim() !== '' && Number(mathVal) === math.answer) {
      navigation.goBack(); // 언마운트되며 알람 정리됨
    } else {
      setWrong(true);
      newRound();
    }
  };

  if (phase === 'reveal') {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>이 숫자를 외우세요</Text>
        <Text style={styles.secret}>{secret}</Text>
        <Text style={styles.hint}>곧 사라집니다…</Text>
      </View>
    );
  }

  if (phase === 'recall') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>잠깐 — 페이스 체크</Text>
        <Text style={styles.step}>1 / 2</Text>
        <View style={styles.block}>
          <Text style={styles.label}>아까 본 4자리 숫자</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={recallInput}
            onChangeText={onRecallChange}
            placeholder="0000"
            placeholderTextColor="#777"
            maxLength={4}
            autoFocus
          />
        </View>
        {wrong && <Text style={styles.wrong}>틀렸어요. 새 문제로 다시.</Text>}
      </View>
    );
  }

  // phase === 'math'
  return (
    <View style={styles.container}>
      <Text style={styles.title}>잠깐 — 페이스 체크</Text>
      <Text style={styles.step}>2 / 2</Text>
      <View style={styles.block}>
        <Text style={styles.label}>{math.text} = ?</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={mathInput}
          onChangeText={setMathInput}
          placeholder="답"
          placeholderTextColor="#777"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => submitMath(mathInput)}
        />
      </View>
      {wrong && <Text style={styles.wrong}>틀렸어요. 새 문제로 다시.</Text>}
      <Pressable style={styles.submitBtn} onPress={() => submitMath(mathInput)}>
        <Text style={styles.submitText}>해제</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  step: { fontSize: 14, color: '#888', marginBottom: 8 },
  label: { fontSize: 18, color: '#ddd' },
  hint: { fontSize: 14, color: '#888' },
  secret: { fontSize: 72, fontWeight: '800', color: '#fff', letterSpacing: 8 },
  block: { width: '100%', gap: 8 },
  input: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  wrong: { color: '#ff6b6b', fontSize: 15 },
  submitBtn: {
    backgroundColor: '#d12c2c',
    paddingVertical: 16,
    paddingHorizontal: 56,
    borderRadius: 16,
    marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});

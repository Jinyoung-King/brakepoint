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

  const [phase, setPhase] = useState<'reveal' | 'answer'>('reveal');
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
    revealTimer.current = setTimeout(() => setPhase('answer'), revealMs(difficulty));
  }, [difficulty]);

  // 알람 시작 (소리 루프 + 진동), 화면 떠날 때 정리
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.loop = true;
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

  const submit = () => {
    const mathOk = mathInput.trim() !== '' && Number(mathInput) === math.answer;
    const recallOk = recallInput.trim() === secret;
    if (mathOk && recallOk) {
      navigation.goBack(); // 언마운트되며 알람 정리됨
    } else {
      setWrong(true);
      newRound(); // 틀리면 새 문제로 계속
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>잠깐 — 페이스 체크</Text>

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
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>아까 본 4자리 숫자</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={recallInput}
          onChangeText={setRecallInput}
          placeholder="0000"
          placeholderTextColor="#777"
          maxLength={4}
        />
      </View>

      {wrong && <Text style={styles.wrong}>틀렸어요. 새 문제로 다시.</Text>}

      <Pressable style={styles.submitBtn} onPress={submit}>
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

import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';

type Props = NativeStackScreenProps<RootStackParamList, 'FakeCall'>;

const RING_VIBRATION = [0, 1000, 2000]; // 1초 진동, 2초 쉼 반복

// One UI '통화 배경' 느낌의 오로라 그라데이션 (상단 어둡고 → 파랑·보라·핑크·주황)
const AURORA = ['#0c0c14', '#221d3c', '#3a3470', '#6b4f86', '#b27a6e', '#cf9263'] as const;

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function FakeCallScreen({ navigation }: Props) {
  const { state } = useAppState();
  const { callerName, callerNumber, photoUri } = state.fakeCall;
  const insets = useSafeAreaInsets();

  const player = useAudioPlayer(require('../../assets/ringtone.wav'));
  const [phase, setPhase] = useState<'ringing' | 'connected'>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 링톤 + 진동 (ringing 동안만). 오디오/진동 호출은 기기/타이밍에 따라
  // 예외가 날 수 있어 전부 방어적으로 감싼다(여기서 터지면 앱이 강제종료됨).
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    try {
      player.loop = true;
      player.volume = 1.0;
      player.play();
    } catch {
      // 오디오 실패해도 통화 UI는 떠야 함
    }
    try {
      Vibration.vibrate(RING_VIBRATION, true);
    } catch {}
    return () => {
      try {
        Vibration.cancel();
      } catch {}
      try {
        player.pause();
      } catch {}
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 통화 중에는 하드웨어 뒤로가기로 종료
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => sub.remove();
  }, [navigation]);

  const stopRinging = () => {
    try {
      Vibration.cancel();
    } catch {}
    try {
      player.pause();
    } catch {}
  };

  const accept = () => {
    stopRinging();
    try {
      Vibration.vibrate(40); // 받을 때 짧은 햅틱
    } catch {}
    setPhase('connected');
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const decline = () => navigation.goBack(); // 정리는 언마운트 cleanup이 처리

  const renderControl = (
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    opts?: { active?: boolean; onPress?: () => void }
  ) => (
    <View style={styles.ctrl}>
      <Pressable
        style={[styles.ctrlBtn, opts?.active && styles.ctrlBtnActive]}
        onPress={opts?.onPress}
        disabled={!opts?.onPress}
      >
        <MaterialIcons name={icon} size={26} color={opts?.active ? '#1a1a1a' : '#fff'} />
      </Pressable>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {photoUri ? (
        <>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)']}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient
          colors={AURORA}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          locations={[0, 0.22, 0.45, 0.65, 0.85, 1]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.top, { paddingTop: insets.top + 64 }]}>
        {phase === 'connected' && <Text style={styles.status}>{fmt(elapsed)}</Text>}
        <Text style={styles.name} numberOfLines={1}>
          {callerName || '알 수 없음'}
        </Text>
        <Text style={styles.number}>
          {phase === 'connected' ? '폰  ' : ''}
          {callerNumber}
        </Text>
      </View>

      {phase === 'ringing' ? (
        <View style={[styles.answerRow, { paddingBottom: insets.bottom + 56 }]}>
          <Pressable style={[styles.answerBtn, styles.acceptBtn]} onPress={accept} hitSlop={12}>
            <MaterialIcons name="call" size={34} color="#fff" />
          </Pressable>
          <Pressable style={[styles.answerBtn, styles.declineBtn]} onPress={decline} hitSlop={12}>
            <MaterialIcons name="call-end" size={34} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.connected, { paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.ctrlGrid}>
            {renderControl('fiber-manual-record', '녹음')}
            {renderControl(muted ? 'mic-off' : 'mic', '내 소리 차단', {
              active: muted,
              onPress: () => setMuted((m) => !m),
            })}
            {renderControl('bluetooth', '블루투스')}
            {renderControl('volume-up', '스피커', {
              active: speaker,
              onPress: () => setSpeaker((s) => !s),
            })}
            {renderControl('dialpad', '키패드')}
            {renderControl('more-horiz', '더 보기')}
          </View>
          <View style={styles.endWrap}>
            <Pressable style={styles.endBtn} onPress={() => navigation.goBack()} hitSlop={12}>
              <MaterialIcons name="call-end" size={32} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', backgroundColor: '#0c0c14' },

  top: { alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  status: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 4 },
  name: { color: '#fff', fontSize: 46, fontWeight: '600', textAlign: 'center' },
  number: { color: 'rgba(255,255,255,0.9)', fontSize: 18 },

  // 수신: 초록(받기)-왼쪽, 빨강(거절)-오른쪽
  answerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 56 },
  answerBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: 'rgba(170,170,180,0.30)',
  },
  acceptBtn: { backgroundColor: '#2fc84e' },
  declineBtn: { backgroundColor: '#f2392c' },

  // 통화 중: 둥근사각 컨트롤 2×3 + 끝내기
  connected: { gap: 30 },
  ctrlGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 22,
    paddingHorizontal: 28,
  },
  ctrl: { width: '33.33%', alignItems: 'center', gap: 8 },
  ctrlBtn: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: '#fff' },
  ctrlLabel: { color: 'rgba(255,255,255,0.92)', fontSize: 13 },
  endWrap: { alignItems: 'center' },
  endBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#f2392c',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

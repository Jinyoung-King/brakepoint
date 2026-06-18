import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppState } from '../state/AppStateContext';

type Props = NativeStackScreenProps<RootStackParamList, 'FakeCall'>;

const RING_VIBRATION = [0, 1000, 2000]; // 1초 진동, 2초 쉼 반복

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function FakeCallScreen({ navigation }: Props) {
  const { state } = useAppState();
  const { callerName, callerNumber, photoUri } = state.fakeCall;

  const player = useAudioPlayer(require('../../assets/ringtone.wav'));
  const [phase, setPhase] = useState<'ringing' | 'connected'>('ringing');
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 링톤 + 진동 (ringing 동안만)
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    player.loop = true;
    player.volume = 1.0;
    player.play();
    Vibration.vibrate(RING_VIBRATION, true);
    return () => {
      Vibration.cancel();
      player.pause();
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
    Vibration.cancel();
    player.pause();
  };

  const accept = () => {
    stopRinging();
    setPhase('connected');
    timer.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const decline = () => navigation.goBack(); // 정리는 언마운트 cleanup이 처리

  const avatar = photoUri ? (
    <Image source={{ uri: photoUri }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarEmpty]}>
      <Text style={styles.avatarInitial}>{(callerName || '?').slice(0, 1)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.status}>{phase === 'ringing' ? '수신 전화' : fmt(elapsed)}</Text>
        {avatar}
        <Text style={styles.name}>{callerName || '알 수 없음'}</Text>
        <Text style={styles.number}>{callerNumber}</Text>
      </View>

      <View style={styles.actions}>
        {phase === 'ringing' ? (
          <>
            <View style={styles.actionCol}>
              <Pressable style={[styles.callBtn, styles.declineBtn]} onPress={decline}>
                <Text style={styles.callBtnIcon}>✕</Text>
              </Pressable>
              <Text style={styles.actionLabel}>거절</Text>
            </View>
            <View style={styles.actionCol}>
              <Pressable style={[styles.callBtn, styles.acceptBtn]} onPress={accept}>
                <Text style={styles.callBtnIcon}>✓</Text>
              </Pressable>
              <Text style={styles.actionLabel}>받기</Text>
            </View>
          </>
        ) : (
          <View style={styles.actionCol}>
            <Pressable style={[styles.callBtn, styles.declineBtn]} onPress={() => navigation.goBack()}>
              <Text style={styles.callBtnIcon}>✕</Text>
            </Pressable>
            <Text style={styles.actionLabel}>종료</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115', justifyContent: 'space-between', paddingVertical: 80 },
  header: { alignItems: 'center', gap: 14 },
  status: { color: '#aaa', fontSize: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginTop: 16 },
  avatarEmpty: { backgroundColor: '#33384a', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 48, fontWeight: '700' },
  name: { color: '#fff', fontSize: 30, fontWeight: '700', marginTop: 8 },
  number: { color: '#aaa', fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  actionCol: { alignItems: 'center', gap: 10 },
  callBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  declineBtn: { backgroundColor: '#e0352b' },
  acceptBtn: { backgroundColor: '#2ecc40' },
  callBtnIcon: { color: '#fff', fontSize: 30, fontWeight: '700' },
  actionLabel: { color: '#ddd', fontSize: 15 },
});

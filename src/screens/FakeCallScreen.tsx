import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
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
const SWIPE_TRIGGER = 90; // 이만큼 위로 밀면 발동
const SWIPE_MAX = 130; // 핸들 최대 이동량

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 위로 밀어서 발동하는 원형 핸들 (받기/거절). 임계점 못 넘으면 제자리로 튕겨 돌아감.
function SwipeHandle({
  color,
  icon,
  hint,
  onTrigger,
}: {
  color: string;
  icon: 'call' | 'call-end';
  hint: string;
  onTrigger: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const hintAnim = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);

  // 위로 밀라는 힌트(셰브론·핸들 살짝 떠오름) 반복 애니메이션
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hintAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(hintAnim, { toValue: 0, duration: 700, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hintAnim]);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_, g) => {
        translateY.setValue(Math.max(-SWIPE_MAX, Math.min(0, g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -SWIPE_TRIGGER && !fired.current) {
          fired.current = true;
          Animated.timing(translateY, { toValue: -SWIPE_MAX, duration: 120, useNativeDriver: true }).start(onTrigger);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const chevronTranslate = hintAnim.interpolate({ inputRange: [0, 1], outputRange: [4, -6] });
  const chevronOpacity = hintAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] });

  return (
    <View style={styles.handleCol}>
      <Animated.View style={{ opacity: chevronOpacity, transform: [{ translateY: chevronTranslate }] }}>
        <MaterialIcons name="keyboard-arrow-up" size={26} color="#fff" />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY }] }} {...responder.panHandlers}>
        <View style={[styles.handleBtn, { backgroundColor: color }]}>
          <MaterialIcons name={icon} size={32} color="#fff" />
        </View>
      </Animated.View>
      <Text style={styles.handleHint}>{hint}</Text>
    </View>
  );
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

  // 아바타 뒤 링 펄스 (수신 중일 때만)
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase !== 'ringing') return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [phase, pulse]);

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

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  const initial = (callerName || '?').slice(0, 1);
  const avatarInner = photoUri ? (
    <Image source={{ uri: photoUri }} style={styles.avatarImg} />
  ) : (
    <View style={[styles.avatarImg, styles.avatarEmpty]}>
      <Text style={styles.avatarInitial}>{initial}</Text>
    </View>
  );

  const renderControl = (
    icon: keyof typeof MaterialIcons.glyphMap,
    label: string,
    active: boolean,
    onPress?: () => void
  ) => (
    <Pressable style={styles.ctrl} onPress={onPress} disabled={!onPress}>
      <View style={[styles.ctrlIcon, active && styles.ctrlIconActive]}>
        <MaterialIcons name={icon} size={24} color={active ? '#111' : '#fff'} />
      </View>
      <Text style={styles.ctrlLabel}>{label}</Text>
    </Pressable>
  );

  return (
    <LinearGradient colors={['#222a3a', '#10141c', '#070809']} style={styles.container}>
      <StatusBar style="light" />

      <View style={[styles.top, { paddingTop: insets.top + 36 }]}>
        <Text style={styles.status}>{phase === 'ringing' ? '수신 전화' : `통화 중 · ${fmt(elapsed)}`}</Text>

        <View style={styles.avatarWrap}>
          {phase === 'ringing' && (
            <Animated.View
              style={[styles.pulseRing, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}
            />
          )}
          {avatarInner}
        </View>

        <Text style={styles.name}>{callerName || '알 수 없음'}</Text>
        <Text style={styles.number}>{callerNumber}</Text>
      </View>

      {phase === 'ringing' ? (
        <View style={[styles.swipeRow, { paddingBottom: insets.bottom + 40 }]}>
          <SwipeHandle color="#e0352b" icon="call-end" hint="밀어서 거절" onTrigger={decline} />
          <SwipeHandle color="#27c24c" icon="call" hint="밀어서 받기" onTrigger={accept} />
        </View>
      ) : (
        <View style={[styles.connected, { paddingBottom: insets.bottom + 36 }]}>
          <View style={styles.ctrlGrid}>
            {renderControl(muted ? 'mic-off' : 'mic', '음소거', muted, () => setMuted((m) => !m))}
            {renderControl('dialpad', '키패드', false)}
            {renderControl('volume-up', '스피커', speaker, () => setSpeaker((s) => !s))}
            {renderControl('bluetooth', '블루투스', false)}
            {renderControl('add', '통화 추가', false)}
            {renderControl('videocam', '영상 통화', false)}
          </View>
          <View style={styles.endWrap}>
            <Pressable style={styles.endBtn} onPress={() => navigation.goBack()}>
              <MaterialIcons name="call-end" size={32} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: 10 },
  status: { color: '#c5cbd6', fontSize: 15, letterSpacing: 1 },
  avatarWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 6 },
  pulseRing: { position: 'absolute', width: 132, height: 132, borderRadius: 66, backgroundColor: '#5b7cff' },
  avatarImg: { width: 124, height: 124, borderRadius: 62 },
  avatarEmpty: { backgroundColor: '#3a4256', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 50, fontWeight: '700' },
  name: { color: '#fff', fontSize: 32, fontWeight: '700', marginTop: 10 },
  number: { color: '#aab1bf', fontSize: 16 },

  swipeRow: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'flex-end' },
  handleCol: { alignItems: 'center', gap: 10, height: SWIPE_MAX + 110, justifyContent: 'flex-end' },
  handleBtn: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  handleHint: { color: '#aab1bf', fontSize: 14 },

  connected: { gap: 36 },
  ctrlGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 26, columnGap: 28, paddingHorizontal: 32 },
  ctrl: { width: 76, alignItems: 'center', gap: 8 },
  ctrlIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ctrlIconActive: { backgroundColor: '#fff' },
  ctrlLabel: { color: '#c5cbd6', fontSize: 13 },
  endWrap: { alignItems: 'center' },
  endBtn: { width: 74, height: 74, borderRadius: 37, backgroundColor: '#e0352b', alignItems: 'center', justifyContent: 'center' },
});

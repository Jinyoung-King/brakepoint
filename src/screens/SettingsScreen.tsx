import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAppState } from '../state/AppStateContext';
import type { Difficulty } from '../storage';
import {
  ensureNotificationSetup,
  openFullScreenIntentSettings,
  triggerTestCall,
} from '../fakeCall/notifications';

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: '쉬움' },
  { key: 'normal', label: '보통' },
  { key: 'hard', label: '어려움' },
];

export default function SettingsScreen() {
  const { state, setLimit, setDifficulty, updateFakeCall, setBrakePercents, setRepeatEveryDrinks } =
    useAppState();
  const { limit, difficulty, fakeCall, brakePercents, repeatEveryDrinks } = state;

  const brake1 = brakePercents[0] ?? 60;
  const brake2 = brakePercents[1] ?? 80;

  // 숫자 입력은 로컬 문자열로 두고 유효할 때만 커밋 (지우는 도중 0 강제 방지)
  const [limitText, setLimitText] = useState(String(limit));
  const [periodText, setPeriodText] = useState(String(fakeCall.periodMin));
  const [brake1Text, setBrake1Text] = useState(String(brake1));
  const [brake2Text, setBrake2Text] = useState(String(brake2));
  const [repeatText, setRepeatText] = useState(String(repeatEveryDrinks));

  const onLimitChange = (t: string) => {
    setLimitText(t);
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1) setLimit(n);
  };
  const onPeriodChange = (t: string) => {
    setPeriodText(t);
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1) updateFakeCall({ periodMin: n });
  };
  const onBrakeChange = (which: 0 | 1) => (t: string) => {
    (which === 0 ? setBrake1Text : setBrake2Text)(t);
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 100) {
      setBrakePercents(which === 0 ? [n, brake2] : [brake1, n]);
    }
  };
  const onRepeatChange = (t: string) => {
    setRepeatText(t);
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1) setRepeatEveryDrinks(n);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });
    if (!res.canceled && res.assets[0]) updateFakeCall({ photoUri: res.assets[0].uri });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* 주량 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>주량 (한계 잔수)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={limitText}
          onChangeText={onLimitChange}
          placeholder="5"
        />
        <Text style={styles.help}>설정한 브레이크 %에서 인지 게이트가 발동합니다.</Text>
      </View>

      {/* 브레이크 지점 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>브레이크 지점</Text>
        <View style={styles.brakeRow}>
          <View style={styles.brakeCol}>
            <Text style={styles.label}>1차 (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={brake1Text}
              onChangeText={onBrakeChange(0)}
              placeholder="60"
            />
            <Text style={styles.help}>{Math.ceil((limit * brake1) / 100)}잔</Text>
          </View>
          <View style={styles.brakeCol}>
            <Text style={styles.label}>2차 (%)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={brake2Text}
              onChangeText={onBrakeChange(1)}
              placeholder="80"
            />
            <Text style={styles.help}>{Math.ceil((limit * brake2) / 100)}잔</Text>
          </View>
        </View>
        <Text style={styles.label}>한계 초과 후 반복 (몇 잔마다)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={repeatText}
          onChangeText={onRepeatChange}
          placeholder="3"
        />
        <Text style={styles.help}>
          1차·2차에서 한 번씩, 한계({limit}잔) 초과 후엔 {repeatEveryDrinks}잔마다 인지 게이트가 뜹니다.
        </Text>
      </View>

      {/* 난이도 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>인지 게이트 난이도</Text>
        <View style={styles.segment}>
          {DIFFICULTIES.map((d) => {
            const active = d.key === difficulty;
            return (
              <Pressable
                key={d.key}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setDifficulty(d.key)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 가짜 전화 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>가짜 전화 발신자</Text>

        <Text style={styles.label}>이름</Text>
        <TextInput
          style={styles.input}
          value={fakeCall.callerName}
          onChangeText={(t) => updateFakeCall({ callerName: t })}
          placeholder="엄마"
        />

        <Text style={styles.label}>번호</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={fakeCall.callerNumber}
          onChangeText={(t) => updateFakeCall({ callerNumber: t })}
          placeholder="010-1234-5678"
        />

        <Text style={styles.label}>사진</Text>
        <View style={styles.photoRow}>
          {fakeCall.photoUri ? (
            <Image source={{ uri: fakeCall.photoUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarEmptyText}>없음</Text>
            </View>
          )}
          <Pressable style={styles.photoBtn} onPress={pickPhoto}>
            <Text style={styles.photoBtnText}>사진 선택</Text>
          </Pressable>
          {fakeCall.photoUri && (
            <Pressable style={styles.photoBtn} onPress={() => updateFakeCall({ photoUri: null })}>
              <Text style={styles.photoBtnText}>제거</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.label}>주기 (분)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={periodText}
          onChangeText={onPeriodChange}
          placeholder="45"
        />
        <Text style={styles.help}>음주모드가 켜져 있으면 이 주기마다 가짜 전화가 옵니다.</Text>

        <Pressable
          style={styles.testBtn}
          onPress={async () => {
            await ensureNotificationSetup();
            await triggerTestCall(fakeCall, 8);
          }}
        >
          <Text style={styles.testBtnText}>지금 테스트 (8초 후 — 화면 잠가보세요)</Text>
        </Pressable>

        {Platform.OS === 'android' && (
          <>
            <Pressable style={styles.permBtn} onPress={openFullScreenIntentSettings}>
              <Text style={styles.permBtnText}>전체 화면 알림 허용 (Android 14+)</Text>
            </Pressable>
            <Text style={styles.help}>
              잠금화면 위로 통화가 안 뜨고 해제해야 보이면, 위 버튼에서 "전체 화면 알림"을 켜주세요.
            </Text>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 28 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 14, color: '#666', marginTop: 4 },
  help: { fontSize: 13, color: '#888' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 17,
  },
  brakeRow: { flexDirection: 'row', gap: 12 },
  brakeCol: { flex: 1, gap: 6 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: '#222', borderColor: '#222' },
  segmentText: { fontSize: 16, color: '#333' },
  segmentTextActive: { color: '#fff', fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  avatarEmptyText: { color: '#999', fontSize: 12 },
  photoBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: '#eee', borderRadius: 10 },
  photoBtnText: { fontSize: 15, color: '#333' },
  testBtn: {
    marginTop: 12,
    backgroundColor: '#2ecc40',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  testBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  permBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a7afe',
    alignItems: 'center',
  },
  permBtnText: { color: '#3a7afe', fontSize: 15, fontWeight: '600' },
});

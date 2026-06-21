import { useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useAppState } from '../state/AppStateContext';
import type { Difficulty, DrinkUnit, ThemeMode } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
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

const UNITS: DrinkUnit[] = ['잔', '병', '캔'];

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'dark', label: '다크' },
  { key: 'light', label: '라이트' },
  { key: 'system', label: '시스템' },
];

export default function SettingsScreen() {
  const {
    state,
    setLimit,
    setDifficulty,
    updateFakeCall,
    setBrakePercents,
    setRepeatEveryDrinks,
    setUnit,
    setCalendarSync,
    setTheme,
  } = useAppState();
  const { limit, difficulty, fakeCall, brakePercents, repeatEveryDrinks, unit, calendarSync, theme } =
    state;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

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
      {/* 테마 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>테마</Text>
        <View style={styles.segment}>
          {THEMES.map((t) => {
            const active = t.key === theme;
            return (
              <Pressable
                key={t.key}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setTheme(t.key)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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

      {/* 단위 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>단위</Text>
        <View style={styles.segment}>
          {UNITS.map((u) => {
            const active = u === unit;
            return (
              <Pressable
                key={u}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setUnit(u)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{u}</Text>
              </Pressable>
            );
          })}
        </View>
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

      {/* 일정 연동 */}
      <View style={styles.section}>
        <View style={styles.toggleRow}>
          <Text style={styles.sectionTitle}>다음날 일정 연동</Text>
          <Switch value={calendarSync} onValueChange={setCalendarSync} />
        </View>
        <Text style={styles.help}>
          켜면 캘린더에서 내일 정오 이전 일정을 확인해, 일정이 있으면 브레이크를 10%p 강화합니다.
        </Text>
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
      <Text style={[styles.help, { textAlign: 'center', marginTop: 8 }]}>brakepoint · OTA rev 1 ✓</Text>
    </ScrollView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { padding: 20, gap: 28, backgroundColor: c.bg },
  section: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text },
  label: { fontSize: 13, color: c.textMuted, marginTop: 4 },
  help: { fontSize: 13, color: c.textFaint },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    color: c.text,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 17,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brakeRow: { flexDirection: 'row', gap: 12 },
  brakeCol: { flex: 1, gap: 6 },
  segment: { flexDirection: 'row', gap: 8 },
  segmentItem: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: c.blue, borderColor: c.blue },
  segmentText: { fontSize: 16, color: c.textMuted },
  segmentTextActive: { color: '#fff', fontWeight: '700' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' },
  avatarEmptyText: { color: c.textFaint, fontSize: 12 },
  photoBtn: { paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.cardAlt, borderRadius: radius.sm },
  photoBtnText: { fontSize: 15, color: c.text },
  testBtn: {
    marginTop: 12,
    backgroundColor: c.green,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  testBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  permBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.blue,
    alignItems: 'center',
  },
  permBtnText: { color: c.blue, fontSize: 15, fontWeight: '600' },
});

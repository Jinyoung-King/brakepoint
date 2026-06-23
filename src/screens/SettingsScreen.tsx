import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useAppState } from '../state/AppStateContext';
import type { Difficulty, DrinkUnit, ThemeMode, Sex, DrinkType } from '../storage';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';
import { importWeightFromHealthConnect, openHealthConnectSettings } from '../health';
import { APP_VERSION } from '../version';
import { canUseFullScreenIntent } from '../../modules/fsi-permission';
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

const SEXES: { key: Sex; label: string }[] = [
  { key: 'male', label: '남' },
  { key: 'female', label: '여' },
];

const DRINK_TYPES: DrinkType[] = ['소주', '맥주', '와인', '양주'];

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
    setSex,
    setWeightKg,
    setDrinkType,
    setHomeAddress,
    setBottleToGlasses,
    setWaterEvery,
    setWeeklyGoalSessions,
    setCheckinEnabled,
    setCheckinDelayMin,
    setSmokingEnabled,
    setMonthlyBudget,
  } = useAppState();
  const { limit, difficulty, fakeCall, brakePercents, repeatEveryDrinks, unit, calendarSync, theme, sex, weightKg, drinkType, homeAddress, bottleToGlasses, waterEvery, weeklyGoalSessions, checkinEnabled, checkinDelayMin, smokingEnabled, monthlyBudget } =
    state;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [weightText, setWeightText] = useState(String(weightKg));
  const [bottleText, setBottleText] = useState(String(bottleToGlasses));
  const [waterText, setWaterText] = useState(String(waterEvery));
  const [goalText, setGoalText] = useState(String(weeklyGoalSessions));
  const [checkinText, setCheckinText] = useState(String(checkinDelayMin));
  const [budgetText, setBudgetText] = useState(monthlyBudget ? String(monthlyBudget) : '');

  // 잠금화면 위 통화(풀스크린 인텐트) 권한 상태. 설정에서 돌아올 때마다 다시 확인.
  const [fsiAllowed, setFsiAllowed] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFsiAllowed(canUseFullScreenIntent());
    }, [])
  );

  const runTestCall = async () => {
    await ensureNotificationSetup();
    if (Platform.OS === 'android' && !canUseFullScreenIntent()) {
      setFsiAllowed(false);
      Alert.alert(
        '전체 화면 알림이 꺼져 있어요',
        '이게 꺼져 있으면 잠금화면에서 진동만 울리고 화면은 안 켜져요. 권한 설정 페이지로 이동할게요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: openFullScreenIntentSettings },
        ]
      );
      return;
    }
    await triggerTestCall(fakeCall, 8);
  };
  const commitNum = (t: string, apply: (n: number) => void, min: number, max: number) => {
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= min && n <= max) apply(n);
  };

  const onImportWeight = async () => {
    const r = await importWeightFromHealthConnect();
    if (r.ok) {
      setWeightKg(r.weightKg);
      setWeightText(String(r.weightKg));
      Alert.alert('가져왔어요', `삼성헬스 기준 몸무게 ${r.weightKg}kg로 설정했어요.`);
      return;
    }
    if (r.reason === 'denied') {
      Alert.alert(
        '권한이 필요해요',
        'Health Connect에서 brakepoint의 "체중 읽기"를 허용해야 해요.\n(한 번 거부하면 시스템 팝업이 다시 안 떠서, 설정에서 직접 켜야 합니다.)',
        [
          { text: '취소', style: 'cancel' },
          { text: 'Health Connect 설정 열기', onPress: () => openHealthConnectSettings() },
        ]
      );
      return;
    }
    const msg =
      r.reason === 'unavailable'
        ? 'Health Connect를 쓸 수 없어요(미설치/미지원 기기).'
        : r.reason === 'no-data'
          ? '저장된 몸무게가 없어요. 삼성헬스 ↔ Health Connect 연결을 확인하세요.'
          : '가져오기에 실패했어요.';
    Alert.alert('가져오기 실패', msg);
  };

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
        <Text style={styles.label}>1병 = ? 잔 (홈의 "+1병" 환산)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={bottleText}
          onChangeText={(t) => {
            setBottleText(t);
            const n = parseInt(t, 10);
            if (Number.isFinite(n) && n >= 1 && n <= 30) setBottleToGlasses(n);
          }}
          placeholder="7"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.help}>소주 1병 ≈ 7잔, 맥주 500 ≈ 2~3잔 정도예요.</Text>
      </View>

      {/* 신체 정보 (BAC 추정용) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>신체 정보 (혈중알코올 추정용)</Text>
        <View style={styles.segment}>
          {SEXES.map((sx) => {
            const active = sx.key === sex;
            return (
              <Pressable
                key={sx.key}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setSex(sx.key)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {sx.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>체중 (kg)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={weightText}
          onChangeText={(t) => {
            setWeightText(t);
            const n = parseInt(t, 10);
            if (Number.isFinite(n) && n >= 30 && n <= 250) setWeightKg(n);
          }}
          placeholder="70"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.label}>주로 마시는 술</Text>
        <View style={styles.segment}>
          {DRINK_TYPES.map((d) => {
            const active = d === drinkType;
            return (
              <Pressable
                key={d}
                style={[styles.segmentItem, active && styles.segmentItemActive]}
                onPress={() => setDrinkType(d)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{d}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.help}>혈중알코올농도·칼로리 추정에 쓰여요(기기에만 저장).</Text>
        <Pressable style={styles.permBtn} onPress={onImportWeight}>
          <Text style={styles.permBtnText}>삼성헬스에서 몸무게 가져오기</Text>
        </Pressable>
        <Text style={styles.help}>
          삼성헬스 ↔ Health Connect 연결 시 최신 몸무게를 불러옵니다. (이름·생년월일은 제공 안 됨)
        </Text>
      </View>

      {/* 집 주소 (안전 귀가) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>집 주소 (안전 귀가)</Text>
        <TextInput
          style={styles.input}
          value={homeAddress}
          onChangeText={setHomeAddress}
          placeholder="예: 서울 은평구 …"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.help}>홈의 "집까지 길찾기"에서 목적지로 사용돼요.</Text>
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

      {/* 건강·안전 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>건강 · 안전</Text>
        <Text style={styles.label}>물 알림 (몇 잔마다, 0=끔)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={waterText}
          onChangeText={(t) => {
            setWaterText(t);
            commitNum(t, setWaterEvery, 0, 20);
          }}
          placeholder="3"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.label}>주간 목표 (술자리 횟수, 0=끔)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={goalText}
          onChangeText={(t) => {
            setGoalText(t);
            commitNum(t, setWeeklyGoalSessions, 0, 30);
          }}
          placeholder="2"
          placeholderTextColor={c.textFaint}
        />
        <View style={styles.toggleRow}>
          <Text style={styles.label}>흡연 트래킹 (음주 중 잔당 흡연)</Text>
          <Switch value={smokingEnabled} onValueChange={setSmokingEnabled} />
        </View>
        <View style={styles.toggleRow}>
          <Text style={styles.label}>귀가 체크인 알림</Text>
          <Switch value={checkinEnabled} onValueChange={setCheckinEnabled} />
        </View>
        <Text style={styles.label}>체크인까지 (분)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={checkinText}
          onChangeText={(t) => {
            setCheckinText(t);
            commitNum(t, setCheckinDelayMin, 5, 240);
          }}
          placeholder="60"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.help}>음주모드를 끄면 이 시간 뒤 "집에 잘 도착했어요?" 알림이 와요.</Text>
        <Text style={styles.label}>월 술값 예산 (원, 0=끔)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={budgetText}
          onChangeText={(t) => {
            setBudgetText(t);
            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
            setMonthlyBudget(Number.isFinite(n) ? n : 0);
          }}
          placeholder="예: 200000"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.help}>기록의 술값 합계가 예산을 넘으면 알려줘요.</Text>
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

        <Pressable style={styles.testBtn} onPress={runTestCall}>
          <Text style={styles.testBtnText}>지금 테스트 (8초 후 — 화면 잠가보세요)</Text>
        </Pressable>

        {Platform.OS === 'android' && (
          <>
            <View style={styles.fsiStatusRow}>
              <Ionicons
                name={fsiAllowed ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={fsiAllowed ? c.green : c.red}
              />
              <Text style={styles.fsiStatusText}>
                전체 화면 알림: {fsiAllowed ? '허용됨' : '차단됨 — 잠금화면 위로 안 떠요'}
              </Text>
            </View>

            <Pressable style={styles.permBtn} onPress={openFullScreenIntentSettings}>
              <Text style={styles.permBtnText}>전체 화면 알림 설정 열기</Text>
            </Pressable>

            <Text style={styles.help}>
              잠금화면 위로 통화를 띄우려면 이 권한이 필요해요(Android 14+ 기본 차단).
              {'\n'}삼성(One UI)이면 추가로 확인하세요:
              {'\n'}· 설정 → 앱 → 브레이크포인트 → 알림 → "전체 화면 알림 표시" ON
              {'\n'}· 설정 → 앱 → 브레이크포인트 → 배터리 → "제한 없음"
            </Text>
          </>
        )}
      </View>
      <Text style={[styles.help, { textAlign: 'center', marginTop: 8 }]}>브레이크포인트 v{APP_VERSION}</Text>
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
  fsiStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  fsiStatusText: { color: c.text, fontSize: 14, fontWeight: '600', flex: 1 },
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

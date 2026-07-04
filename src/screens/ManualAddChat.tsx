import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

import type { DrinkType, DrinkUnit } from '../storage';
import { DRINK_UNITS, WEEKDAYS } from '../constants';
import { radius, type Palette } from '../theme';
import { useColors } from '../useColors';

export type ManualChatInput = {
  count: number;
  limit: number;
  at: number;
  unit: DrinkUnit;
  type: DrinkType;
  place?: string;
  memo?: string;
  cost?: number;
};

type Props = {
  visible: boolean;
  initialWhen?: Date | null;
  limit: number;
  defaultType: DrinkType;
  defaultUnit: DrinkUnit;
  drinkTypes: string[]; // 기본 5종 + 커스텀 주종
  onCancel: () => void;
  onSubmit: (input: ManualChatInput) => void;
};

// 대화 단계
const DATE = 0, TIME = 1, TYPE = 2, AMOUNT = 3, EXTRA = 4, CONFIRM = 5;

// 시각 프리셋 (라벨, 시)
const TIME_PRESETS: { label: string; h: number }[] = [
  { label: '점심 12시', h: 12 },
  { label: '저녁 6시', h: 18 },
  { label: '저녁 9시', h: 21 },
  { label: '밤 11시', h: 23 },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function relDayLabel(d: Date): string {
  const daysAgo = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (daysAgo === 0) return '오늘';
  if (daysAgo === 1) return '어제';
  if (daysAgo === 2) return '그저께';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function friendlyTimeLabel(d: Date): string {
  const h = d.getHours();
  const period = h < 6 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const m = d.getMinutes();
  return m === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${m}분`;
}

function defaultWhen(base?: Date | null): Date {
  const d = base ? new Date(base) : new Date();
  d.setHours(21, 0, 0, 0);
  return d;
}

export default function ManualAddChat({ visible, initialWhen, limit, defaultType, defaultUnit, drinkTypes, onCancel, onSubmit }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [when, setWhen] = useState(() => defaultWhen(initialWhen));
  const [type, setType] = useState<DrinkType>(defaultType);
  const [unit, setUnit] = useState<DrinkUnit>(defaultUnit);
  const [amt, setAmt] = useState('1');
  const [place, setPlace] = useState('');
  const [cost, setCost] = useState('');
  const [step, setStep] = useState(DATE);
  const [maxStep, setMaxStep] = useState(DATE);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // 열릴 때마다 초기화
  useEffect(() => {
    if (!visible) return;
    setWhen(defaultWhen(initialWhen));
    setType(defaultType);
    setUnit(defaultUnit);
    setAmt('1');
    setPlace('');
    setCost('');
    setStep(DATE);
    setMaxStep(DATE);
    setPicker(null);
  }, [visible, initialWhen, defaultType, defaultUnit]);

  // 단계 답변 → 다음으로 (이미 확인까지 갔었다면 바로 확인으로 복귀 = 한 항목만 고치기)
  const answered = (i: number) => {
    setMaxStep((m) => Math.max(m, i + 1));
    setStep(maxStep >= CONFIRM ? CONFIRM : i + 1);
  };
  const jump = (i: number) => setStep(i); // 지난 답변 말풍선 탭 → 그 단계로 되돌아가 수정

  const amtNum = parseFloat(amt) || 0;
  const bump = (delta: number) => {
    const next = Math.max(0, Math.round((amtNum + delta) * 100) / 100);
    setAmt(String(next));
  };

  const setDay = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(when.getHours(), when.getMinutes(), 0, 0);
    setWhen(d);
    answered(DATE);
  };
  const setPreset = (h: number) => {
    const d = new Date(when);
    d.setHours(h, 0, 0, 0);
    setWhen(d);
    answered(TIME);
  };

  const extraSummary = [place.trim(), cost.trim() ? `${Number(cost.replace(/[^0-9]/g, '')).toLocaleString('ko-KR')}원` : '']
    .filter(Boolean)
    .join(' · ');
  const summaryText = `정리해볼게요 —\n${relDayLabel(when)} ${friendlyTimeLabel(when)}, ${type} ${amt}${unit}${extraSummary ? `\n${extraSummary}` : ''}\n맞아요?`;

  const save = () => {
    const won = parseInt(cost.replace(/[^0-9]/g, ''), 10);
    onSubmit({
      count: amtNum,
      limit,
      at: when.getTime(),
      unit,
      type,
      place: place.trim() || undefined,
      cost: Number.isFinite(won) && won > 0 ? won : undefined,
    });
  };

  const whenDaysAgo = Math.round((startOfDay(new Date()) - startOfDay(when)) / 86400000);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>수동 기록 추가</Text>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button" accessibilityLabel="닫기">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.chat}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {bot(styles, '언제 마셨어요?')}
            {step > DATE && me(styles, relDayLabel(when), () => jump(DATE))}
            {step >= TIME && bot(styles, '몇 시쯤이었어요?')}
            {step > TIME && me(styles, friendlyTimeLabel(when), () => jump(TIME))}
            {step >= TYPE && bot(styles, '뭘 마셨어요?')}
            {step > TYPE && me(styles, type, () => jump(TYPE))}
            {step >= AMOUNT && bot(styles, '얼마나 마셨어요?')}
            {step > AMOUNT && me(styles, `${amt}${unit}`, () => jump(AMOUNT))}
            {step >= EXTRA && bot(styles, '어디서 마셨는지, 얼마 썼는지 알려줄래요? (선택)')}
            {step > EXTRA && me(styles, extraSummary || '생략', () => jump(EXTRA))}
            {step >= CONFIRM && bot(styles, summaryText)}
          </ScrollView>

          {/* 답변 컨트롤 (현재 단계) */}
          <View style={styles.answer}>
            {step === DATE && (
              <View style={styles.chips}>
                {[{ l: '오늘', v: 0 }, { l: '어제', v: 1 }, { l: '그저께', v: 2 }].map((d) => {
                  const on = whenDaysAgo === d.v;
                  return (
                    <Pressable key={d.v} style={[styles.chip, on && styles.chipOn]} onPress={() => setDay(d.v)} accessibilityRole="button" accessibilityLabel={`날짜 ${d.l}`}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{d.l}</Text>
                    </Pressable>
                  );
                })}
                <Pressable style={styles.chip} onPress={() => setPicker('date')} accessibilityRole="button" accessibilityLabel="날짜 직접 고르기">
                  <Text style={styles.chipText}>📅 날짜 고르기</Text>
                </Pressable>
              </View>
            )}

            {step === TIME && (
              <View style={styles.chips}>
                {TIME_PRESETS.map((t) => (
                  <Pressable key={t.h} style={styles.chip} onPress={() => setPreset(t.h)} accessibilityRole="button" accessibilityLabel={t.label}>
                    <Text style={styles.chipText}>{t.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={styles.chip} onPress={() => setPicker('time')} accessibilityRole="button" accessibilityLabel="시각 직접 고르기">
                  <Text style={styles.chipText}>🕘 직접</Text>
                </Pressable>
              </View>
            )}

            {step === TYPE && (
              <View style={styles.chips}>
                {drinkTypes.map((t) => {
                  const on = t === type;
                  return (
                    <Pressable key={t} style={[styles.chip, on && styles.chipOn]} onPress={() => { setType(t); answered(TYPE); }} accessibilityRole="button" accessibilityLabel={`주종 ${t}`}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {step === AMOUNT && (
              <View style={styles.amountWrap}>
                <View style={styles.chips}>
                  {DRINK_UNITS.map((u) => {
                    const on = u === unit;
                    return (
                      <Pressable key={u} style={[styles.chip, on && styles.chipOn]} onPress={() => setUnit(u)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`단위 ${u}`}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{u}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.stepperRow}>
                  <View style={styles.stepper}>
                    <Pressable style={styles.stepBtn} onPress={() => bump(-1)} accessibilityRole="button" accessibilityLabel="하나 빼기">
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <TextInput style={styles.countInput} keyboardType="decimal-pad" value={amt} onChangeText={setAmt} textAlign="center" accessibilityLabel={`마신 ${unit}`} />
                    <Pressable style={styles.stepBtn} onPress={() => bump(1)} accessibilityRole="button" accessibilityLabel="하나 더하기">
                      <Text style={styles.stepBtnText}>＋</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.unitTail}>{unit}</Text>
                  <Pressable style={[styles.send, amtNum <= 0 && styles.sendOff]} disabled={amtNum <= 0} onPress={() => answered(AMOUNT)} accessibilityRole="button" accessibilityLabel="이만큼 마셨어요">
                    <Text style={styles.sendText}>이만큼</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {step === EXTRA && (
              <View style={styles.extraWrap}>
                <TextInput style={styles.input} value={place} onChangeText={setPlace} placeholder="장소 (예: 연신내 ○○)" placeholderTextColor={c.textFaint} />
                <TextInput style={styles.input} keyboardType="number-pad" value={cost} onChangeText={setCost} placeholder="술값 (원)" placeholderTextColor={c.textFaint} />
                <View style={styles.rowBtns}>
                  <Pressable onPress={() => { setPlace(''); setCost(''); answered(EXTRA); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="건너뛰기">
                    <Text style={styles.skip}>건너뛰기</Text>
                  </Pressable>
                  <Pressable style={styles.send} onPress={() => answered(EXTRA)} accessibilityRole="button" accessibilityLabel="다음">
                    <Text style={styles.sendText}>다음</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {step === CONFIRM && (
              <View style={styles.rowBtns}>
                <Pressable onPress={() => { setStep(DATE); setMaxStep(DATE); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="처음부터 다시">
                  <Text style={styles.skip}>처음부터</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={save} accessibilityRole="button" accessibilityLabel="저장">
                  <Text style={styles.saveText}>저장</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {picker && (
        <DateTimePicker
          value={when}
          mode={picker}
          is24Hour
          maximumDate={new Date()}
          onChange={(event, selected) => {
            const which = picker;
            setPicker(null);
            if (event.type === 'dismissed' || !selected) return;
            const next = new Date(when);
            if (which === 'date') next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
            else next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
            setWhen(next);
            answered(which === 'date' ? DATE : TIME);
          }}
        />
      )}
    </Modal>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: c.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: c.text },
  close: { fontSize: 18, color: c.textMuted, fontWeight: '700' },
  chat: { flexShrink: 1, marginBottom: 8 },
  botRow: { flexDirection: 'row', justifyContent: 'flex-start', marginVertical: 4 },
  botBubble: { maxWidth: '82%', backgroundColor: c.cardAlt, borderRadius: 16, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  botText: { fontSize: 15, color: c.text, lineHeight: 21 },
  meRow: { flexDirection: 'row', justifyContent: 'flex-end', marginVertical: 4 },
  meBubble: { maxWidth: '82%', backgroundColor: c.blue, borderRadius: 16, borderTopRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  meText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  answer: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt },
  chipOn: { backgroundColor: c.blue, borderColor: c.blue },
  chipText: { fontSize: 15, color: c.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  amountWrap: { gap: 10 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: c.cardAlt },
  stepBtnText: { fontSize: 22, color: c.blue, fontWeight: '800' },
  countInput: { minWidth: 52, color: c.text, fontSize: 22, fontWeight: '800', paddingVertical: 6 },
  unitTail: { fontSize: 17, color: c.text, fontWeight: '700' },
  send: { marginLeft: 'auto', backgroundColor: c.blue, paddingVertical: 10, paddingHorizontal: 18, borderRadius: radius.sm },
  sendOff: { opacity: 0.4 },
  sendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  extraWrap: { gap: 8 },
  input: { borderWidth: 1, borderColor: c.border, backgroundColor: c.cardAlt, color: c.text, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  rowBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 20, marginTop: 4 },
  skip: { fontSize: 15, color: c.textMuted, fontWeight: '600' },
  saveBtn: { backgroundColor: c.blue, paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.sm },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

type Styles = ReturnType<typeof makeStyles>;

// 말풍선 렌더 (컴포넌트가 아니라 순수 렌더 함수 — 렌더 중 컴포넌트 생성 규칙 회피)
function bot(styles: Styles, text: string) {
  return (
    <View style={styles.botRow}>
      <View style={styles.botBubble}>
        <Text style={styles.botText}>{text}</Text>
      </View>
    </View>
  );
}
function me(styles: Styles, label: string, onEdit: () => void) {
  return (
    <Pressable style={styles.meRow} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${label} — 탭해서 수정`}>
      <View style={styles.meBubble}>
        <Text style={styles.meText}>{label}</Text>
      </View>
    </Pressable>
  );
}

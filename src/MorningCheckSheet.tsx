import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useColors } from './useColors';
import { radius } from './theme';
import type { MorningLog, SessionRecord } from './storage';

type Props = {
  record: SessionRecord | null;
  onSave: (id: string, log: MorningLog) => void;
  onClose: () => void;
};

const HANGOVER: { v: 0 | 1 | 2 | 3; label: string }[] = [
  { v: 0, label: '쌩쌩' },
  { v: 1, label: '약간' },
  { v: 2, label: '꽤' },
  { v: 3, label: '최악' },
];

const SLEEP: { v: 0 | 1 | 2; label: string }[] = [
  { v: 0, label: '푹 잤다' },
  { v: 1, label: '그럭저럭' },
  { v: 2, label: '설쳤다' },
];

function fmtNight(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 다음날 아침 컨디션 기록 시트. 탭 몇 번으로 숙취·수면·후회를 남긴다.
// 이미 기록이 있으면(수정) 기존 값을 초깃값으로 채운다.
export default function MorningCheckSheet({ record, onSave, onClose }: Props) {
  const c = useColors();
  const styles = makeStyles(c);
  const [hangover, setHangover] = useState<0 | 1 | 2 | 3 | null>(null);
  const [sleep, setSleep] = useState<0 | 1 | 2 | null>(null);
  const [regret, setRegret] = useState(false);
  const [note, setNote] = useState('');

  // 대상 기록이 바뀌면 폼을 그 기록의 기존 값으로 리셋.
  useEffect(() => {
    const m = record?.morning;
    setHangover(m?.hangover ?? null);
    setSleep(m?.sleep ?? null);
    setRegret(m?.regret ?? false);
    setNote(m?.note ?? '');
    // 대상 기록이 바뀔 때만 리셋(같은 기록의 morning 변경엔 반응 안 함).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  if (!record) return null;

  const hangColor = hangover == null ? c.blue : [c.green, c.green, c.amber, c.red][hangover];

  const save = () => {
    if (hangover == null) return;
    onSave(record.id, {
      at: Date.now(),
      hangover,
      sleep: sleep ?? undefined,
      regret: regret || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>오늘 아침 컨디션</Text>
            <Text style={styles.muted}>
              {fmtNight(record.endedAt)} 밤 · {record.count}
              {record.unit ?? '잔'}
              {record.round && record.round > 1 ? ` · ${record.round}차` : ''} 마셨어요
            </Text>

            <Text style={styles.label}>숙취는 어때요?</Text>
            <View style={styles.row}>
              {HANGOVER.map((h) => {
                const on = hangover === h.v;
                const col = [c.green, c.green, c.amber, c.red][h.v];
                return (
                  <Pressable
                    key={h.v}
                    onPress={() => setHangover(h.v)}
                    style={[styles.chip, on && { backgroundColor: col, borderColor: col }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`숙취 ${h.label}`}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{h.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>잠은 잘 잤어요? (선택)</Text>
            <View style={styles.row}>
              {SLEEP.map((s) => {
                const on = sleep === s.v;
                return (
                  <Pressable
                    key={s.v}
                    onPress={() => setSleep(on ? null : s.v)}
                    style={[styles.chip, on && { backgroundColor: c.blue, borderColor: c.blue }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`수면 ${s.label}`}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setRegret((r) => !r)}
              style={[styles.regret, regret && { backgroundColor: c.amberBg, borderColor: c.amber }]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: regret }}
            >
              <Text style={[styles.regretText, { color: regret ? c.amber : c.textMuted }]}>
                {regret ? '● ' : '○ '}다음엔 조금만 마실래
              </Text>
            </Pressable>

            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="한줄 메모 (선택) — 예: 라면 먹고 잠"
              placeholderTextColor={c.textFaint}
            />

            <View style={styles.btns}>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.link}>나중에</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={hangover == null}
                style={[styles.saveBtn, { backgroundColor: hangColor }, hangover == null && styles.saveBtnOff]}
              >
                <Text style={styles.saveBtnText}>기록하기</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: 24 },
    card: {
      backgroundColor: c.card,
      borderRadius: radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: c.border,
      maxHeight: '85%',
    },
    title: { fontSize: 19, fontWeight: '700', color: c.text },
    muted: { fontSize: 13, color: c.textMuted, marginTop: 4 },
    label: { fontSize: 13, color: c.textMuted, marginTop: 16, marginBottom: 8 },
    row: { flexDirection: 'row', gap: 8 },
    chip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardAlt,
    },
    chipText: { fontSize: 15, fontWeight: '600', color: c.text },
    chipTextOn: { color: '#fff' },
    regret: {
      marginTop: 16,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardAlt,
    },
    regretText: { fontSize: 15, fontWeight: '600' },
    input: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.cardAlt,
      color: c.text,
      borderRadius: radius.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
    },
    btns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
    link: { fontSize: 15, color: c.blue },
    saveBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: radius.sm },
    saveBtnOff: { opacity: 0.4 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  });
}

import { useEffect, useState } from 'react';
import * as Calendar from 'expo-calendar';

import { confirmRationale } from '../permissionRationale';

export type MorningEvent = { title: string; startMs: number };

// 내일 정오 이전에 일정이 있으면 그 첫 일정을 반환. 없으면 null.
// 권한 거부/오류 시 null (조용히 무시).
export function useMorningSchedule(enabled: boolean): MorningEvent | null {
  const [event, setEvent] = useState<MorningEvent | null>(null);

  useEffect(() => {
    if (!enabled) {
      setEvent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const current = await Calendar.getCalendarPermissionsAsync();
        if (!current.granted) {
          const ok = await confirmRationale(
            '캘린더 권한',
            '내일 오전에 일정이 있으면 미리 알려주고 음주 페이스를 더 조이는 데만 써요. 일정 내용을 저장하지 않아요.'
          );
          if (!ok) return;
        }
        const perm = await Calendar.requestCalendarPermissionsAsync();
        if (!perm.granted) return;
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        if (!cals.length) return;

        const start = new Date();
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0); // 내일 00:00
        const end = new Date(start);
        end.setHours(12, 0, 0, 0); // 내일 12:00

        const events = await Calendar.getEventsAsync(
          cals.map((c) => c.id),
          start,
          end
        );
        if (cancelled || !events.length) return;

        const first = events
          .map((e) => ({ title: e.title || '일정', startMs: new Date(e.startDate).getTime() }))
          .sort((a, b) => a.startMs - b.startMs)[0];
        setEvent(first);
      } catch {
        // 권한/플랫폼 문제 시 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return event;
}

import { useEffect } from 'react';

import { useAppState } from './state/AppStateContext';
import { lastWeekReport, nextWeeklyReportAt } from './stats';
import { scheduleWeeklyReport, cancelWeeklyReport } from './weeklyReport';

// 주간 리포트 알림이 켜져 있으면, 앱이 준비되거나 기록이 바뀔 때마다
// 다음 월요일 09:00 알림을 (알림 시점 기준 지난주 요약으로) 재예약한다.
export default function WeeklyReportController() {
  const { state, ready } = useAppState();
  const { weeklyReportEnabled, history } = state;

  useEffect(() => {
    if (!ready) return;
    if (!weeklyReportEnabled) {
      cancelWeeklyReport();
      return;
    }
    const fireAt = nextWeeklyReportAt(Date.now());
    scheduleWeeklyReport(fireAt, lastWeekReport(history, fireAt));
  }, [ready, weeklyReportEnabled, history]);

  return null;
}

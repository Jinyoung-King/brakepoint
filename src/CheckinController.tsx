import { useEffect, useRef } from 'react';

import { useAppState } from './state/AppStateContext';
import { scheduleCheckin, cancelCheckin } from './checkin';

// 음주모드가 켜짐→꺼짐으로 바뀌면 귀가 체크인 알림 예약. 다시 켜지면 취소.
export default function CheckinController() {
  const { state, ready } = useAppState();
  const { drinkingMode, checkinEnabled, checkinDelayMin } = state;
  const prev = useRef(drinkingMode);

  useEffect(() => {
    if (!ready) return;
    const was = prev.current;
    prev.current = drinkingMode;
    if (drinkingMode) {
      cancelCheckin();
    } else if (was && !drinkingMode && checkinEnabled) {
      scheduleCheckin(checkinDelayMin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drinkingMode]);

  return null;
}

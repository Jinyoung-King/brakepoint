import { useEffect } from 'react';

import { useAppState } from './state/AppStateContext';
import { updateWidget, widgetAvailable } from '../modules/widget-bridge';

// 화면을 그리지 않고: 잔/한계가 바뀌면 홈 위젯을 갱신한다. 모듈 없으면 no-op.
export default function WidgetController() {
  const { state, ready } = useAppState();
  const { count, limit } = state;

  useEffect(() => {
    if (!ready || !widgetAvailable) return;
    updateWidget(count, limit);
  }, [ready, count, limit]);

  return null;
}

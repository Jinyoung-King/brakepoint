import { useEffect } from 'react';

import { useAppState } from './state/AppStateContext';
import { alcoholGrams, sessionStdCount, STD_GRAMS } from './bac';
import { updateWidget, widgetAvailable } from '../modules/widget-bridge';

// 화면을 그리지 않고: 취기(표준잔)가 바뀌면 홈 위젯을 갱신한다. 모듈 없으면 no-op.
// 위젯도 홈 게이지와 같은 sessionStdCount 기준이라 약한 술을 마셔도 %가 어긋나지 않는다.
export default function WidgetController() {
  const { state, ready } = useAppState();
  const { count, limit, widgetTheme, drinkEvents, unit, drinkType, customDrinks } = state;

  const std = sessionStdCount(drinkEvents, count, unit, drinkType, customDrinks);
  // 위젯 "+1"(현재 주종 한 잔)이 더해질 때 늘어나는 표준잔. 낙관적 갱신을 앱과 일치시킨다.
  const perDrinkStd = alcoholGrams(1, unit, drinkType, customDrinks) / STD_GRAMS;

  useEffect(() => {
    if (!ready || !widgetAvailable) return;
    updateWidget(std, limit, perDrinkStd, widgetTheme);
  }, [ready, std, limit, perDrinkStd, widgetTheme]);

  return null;
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';

import MainTabs, { type MainTabParamList } from './MainTabs';
import CognitiveGateScreen from '../screens/CognitiveGateScreen';
import FakeCallScreen from '../screens/FakeCallScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useAppState } from '../state/AppStateContext';

// 앱 전역 라우트. 메인 화면들은 Main(탭)에 들어있고, 인지게이트/가짜통화는 그 위 풀스크린.
export type RootStackParamList = {
  Onboarding: undefined;
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  CognitiveGate: undefined;
  FakeCall: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { state } = useAppState();

  return (
    <Stack.Navigator
      initialRouteName={state.onboarded ? 'Main' : 'Onboarding'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="Main" component={MainTabs} />
      {/* 인지 게이트 / 가짜 통화는 풀스크린 모달처럼 (탭바 위로) 띄움 */}
      <Stack.Screen
        name="CognitiveGate"
        component={CognitiveGateScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <Stack.Screen
        name="FakeCall"
        component={FakeCallScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

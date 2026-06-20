import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CognitiveGateScreen from '../screens/CognitiveGateScreen';
import FakeCallScreen from '../screens/FakeCallScreen';
import HistoryScreen from '../screens/HistoryScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { useAppState } from '../state/AppStateContext';

// 앱 전역 라우트 정의. 화면이 받을 파라미터가 생기면 여기서 타입 확장.
export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CognitiveGate: undefined;
  FakeCall: undefined;
  History: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { state } = useAppState();

  return (
    <Stack.Navigator
      initialRouteName={state.onboarded ? 'Home' : 'Onboarding'}
      screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'brakepoint' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: '기록' }} />
      {/* 인지 게이트 / 가짜 통화는 풀스크린 모달처럼 띄움 (헤더 없음) */}
      <Stack.Screen
        name="CognitiveGate"
        component={CognitiveGateScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="FakeCall"
        component={FakeCallScreen}
        options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}

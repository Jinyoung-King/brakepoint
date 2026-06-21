import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AppStateProvider, useAppState } from './src/state/AppStateContext';
import FakeCallController from './src/fakeCall/FakeCallController';
import CheckinController from './src/CheckinController';
import ErrorBoundary from './src/ErrorBoundary';
import { lightColors } from './src/theme';
import { useColors } from './src/useColors';

// AsyncStorage 로드가 끝난 뒤에야 네비게이터를 띄운다
// (onboarded 값이 정해져야 시작 화면을 올바르게 고를 수 있음)
function Root() {
  const { ready } = useAppState();
  const c = useColors();
  const isDark = c !== lightColors;
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      background: c.bg,
      card: c.card,
      text: c.text,
      border: c.border,
      primary: c.blue,
    },
  };
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <FakeCallController />
      <CheckinController />
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

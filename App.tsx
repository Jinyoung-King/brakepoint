import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AppStateProvider, useAppState } from './src/state/AppStateContext';
import FakeCallController from './src/fakeCall/FakeCallController';

// AsyncStorage 로드가 끝난 뒤에야 네비게이터를 띄운다
// (onboarded 값이 정해져야 시작 화면을 올바르게 고를 수 있음)
function Root() {
  const { ready } = useAppState();
  if (!ready) return <View style={{ flex: 1, backgroundColor: '#fff' }} />;
  return (
    <NavigationContainer ref={navigationRef}>
      <FakeCallController />
      <RootNavigator />
      <StatusBar style="auto" />
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

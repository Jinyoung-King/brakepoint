import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AppStateProvider } from './src/state/AppStateContext';
import FakeCallController from './src/fakeCall/FakeCallController';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <NavigationContainer ref={navigationRef}>
          <FakeCallController />
          <RootNavigator />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import GlassTabBar from './GlassTabBar';

export type MainTabParamList = {
  Home: undefined;
  History: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// 메인 3탭. 헤더는 각 탭이 제공하고, 하단은 글라스 알약 탭바로 화면만 전환.
export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShadowVisible: false, headerTitleStyle: { fontWeight: '700' } }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '브레이크포인트' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: '기록' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '설정' }} />
    </Tab.Navigator>
  );
}

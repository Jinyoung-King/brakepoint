import { registerRootComponent } from 'expo';
import notifee from '@notifee/react-native';

import App from './App';

// notifee 백그라운드 이벤트 핸들러 (앱이 백그라운드/종료 상태일 때 호출됨).
// 풀스크린 인텐트로 앱이 열리면 FakeCallController의 getInitialNotification이 라우팅하므로
// 여기서는 별도 처리 없이 등록만 해 둔다(미등록 시 notifee 경고 발생).
notifee.onBackgroundEvent(async () => {});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

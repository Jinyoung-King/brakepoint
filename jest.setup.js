// Jest 환경에서 네이티브 모듈 mock. (테스트는 순수 로직만 검증)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// notifee: 네이티브 브리지가 없어 import만으로 throw → API를 no-op으로 mock.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'ch'),
    createTriggerNotification: jest.fn(async () => 'id'),
    cancelTriggerNotification: jest.fn(async () => {}),
    cancelNotification: jest.fn(async () => {}),
    displayNotification: jest.fn(async () => 'id'),
    onForegroundEvent: jest.fn(() => () => {}),
    onBackgroundEvent: jest.fn(),
    getInitialNotification: jest.fn(async () => null),
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  EventType: { DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3, TRIGGER_NOTIFICATION_CREATED: 7 },
}));

// Jest 환경에서 네이티브 모듈 mock. (테스트는 순수 로직만 검증)
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

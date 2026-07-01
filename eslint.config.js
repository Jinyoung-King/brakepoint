// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // React Native의 <Text>는 HTML이 아니라 따옴표(")·괄호를 그대로 써도 안전하다.
      // 이 규칙은 웹(HTML) 전용 이슈라 RN 앱에선 끈다.
      "react/no-unescaped-entities": "off",

      // 아래는 eslint-plugin-react-hooks의 React Compiler 계열 규칙들.
      // RN/Expo의 관용적 패턴을 오탐하거나(예: Animated.Value 참조, expo-audio player 변형)
      // 동작을 바꿔야만 통과되는 것들이라, 배포된 앱 회귀 위험을 피해 끈다.
      "react-hooks/refs": "off", // useRef(new Animated.Value()).current 읽기
      "react-hooks/immutability": "off", // expo-audio player.loop/volume 변형
      "react-hooks/purity": "off", // 렌더 중 Date.now() (1분 tick으로 갱신하는 시간 표시)
      "react-hooks/set-state-in-effect": "off", // effect 내 초기 동기화 setState
      "react-hooks/preserve-manual-memoization": "off",
    },
  }
]);

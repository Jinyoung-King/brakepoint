const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// 라이브러리(expo-image-picker 등)가 매니페스트 머지로 끌고 오는 불필요 권한.
const REMOVE_PERMISSIONS = ['android.permission.RECORD_AUDIO'];

// 1) MainActivity가 잠금화면 위에서 표시되고 화면을 켜도록 속성 추가
//    (notifee fullScreenAction이 이 액티비티를 잠금화면 위로 띄움)
// 2) 사용하지 않는 권한을 머지 단계에서 제거
module.exports = function withFullScreenIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    // 잠금화면 표시 속성
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const main = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }

    // tools 네임스페이스 + 권한 remove 지시
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of REMOVE_PERMISSIONS) {
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p.$['android:name'] !== name
      );
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }

    return cfg;
  });
};

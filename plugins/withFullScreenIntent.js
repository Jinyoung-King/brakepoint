const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// MainActivity가 잠금화면 위에서 표시되고 화면을 켜도록 매니페스트 속성 추가.
// (notifee fullScreenAction이 이 액티비티를 잠금화면 위로 띄움)
module.exports = function withFullScreenIntent(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const main = (app.activity || []).find(
      (a) => a.$['android:name'] === '.MainActivity'
    );
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};

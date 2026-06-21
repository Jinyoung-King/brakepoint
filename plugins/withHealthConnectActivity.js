const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

// Android 14+에서 Health Connect는 시스템에 통합됨. 앱이 인식되려면
// VIEW_PERMISSION_USAGE / HEALTH_PERMISSIONS 액티비티-별칭이 있어야 한다.
// (react-native-health-connect 플러그인이 이걸 안 넣어줘서 직접 추가)
module.exports = function withHealthConnectActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app['activity-alias'] = app['activity-alias'] || [];
    const exists = app['activity-alias'].some(
      (a) => a.$['android:name'] === 'ViewPermissionUsageActivity'
    );
    if (!exists) {
      app['activity-alias'].push({
        $: {
          'android:name': 'ViewPermissionUsageActivity',
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW_PERMISSION_USAGE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.HEALTH_PERMISSIONS' } }],
          },
        ],
      });
    }
    return cfg;
  });
};

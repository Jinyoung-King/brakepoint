const { withMainActivity } = require('@expo/config-plugins');

// react-native-health-connect는 권한 요청을 위해 MainActivity.onCreate에서
// HealthConnectPermissionDelegate.setPermissionDelegate(this)를 호출해야 한다.
// (안 하면 requestPermission 시 네이티브 크래시) — 자동 주입되지 않아 직접 넣음.
const IMPORT = 'import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate';
const CALL = 'HealthConnectPermissionDelegate.setPermissionDelegate(this)';

module.exports = function withHealthConnectDelegate(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(IMPORT)) {
      src = src.replace(/(^package .*$)/m, `$1\n\n${IMPORT}`);
    }
    if (!src.includes(CALL)) {
      // super.onCreate(...) 바로 뒤에 델리게이트 등록
      src = src.replace(/(super\.onCreate\([^)]*\))/, `$1\n    ${CALL}`);
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};

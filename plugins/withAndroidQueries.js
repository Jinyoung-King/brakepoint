const { withAndroidManifest } = require('@expo/config-plugins');

// Android 11+ 패키지 가시성: 카카오맵/네이버지도/카카오T를 앱 스킴으로 직접 열려면
// <queries>에 패키지를 선언해야 함(없으면 웹으로만 폴백됨).
const PACKAGES = [
  'net.daum.android.map', // 카카오맵
  'com.nhn.android.nmap', // 네이버지도
  'com.kakao.taxi', // 카카오T
];

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [];
    let q = manifest.queries[0];
    if (!q) {
      q = {};
      manifest.queries.push(q);
    }
    q.package = q.package || [];
    for (const name of PACKAGES) {
      if (!q.package.some((p) => p.$['android:name'] === name)) {
        q.package.push({ $: { 'android:name': name } });
      }
    }
    return cfg;
  });
};

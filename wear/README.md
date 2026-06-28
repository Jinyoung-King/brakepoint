# 브레이크포인트 — Wear OS 앱

폰(Expo) 앱과 **분리된 독립 Gradle 프로젝트**입니다. `expo prebuild`가 재생성하는
`android/`를 건드리지 않아 안전합니다. 폰 앱과 **같은 applicationId**(`kr.co.cruxdata.brakepoint`)
라서 Wear Data Layer로 통신합니다.

## 동작
- 워치 화면: 현재 `잔 / 한계` 표시 + 큰 `+1` 버튼
- `+1` 누르면 → 폰으로 `/brakepoint/add` 전송 → 폰이 잔 추가(브레이크/물 규칙 동일)
- 폰에서 잔/한계/BAC 바뀌면 → `/brakepoint/state`로 워치에 갱신

## ⚠️ 빌드 전 준비
1. **폰 앱을 로컬로 새로 빌드**해야 함 — `modules/wear-bridge`가 추가돼서, 현재 OTA 빌드엔
   브리지가 없음(없으면 워치 메시지를 못 받음). `docs/local-build-setup.md`대로 prebuild→APK.
2. **Gradle wrapper 복사** (이 폴더엔 gradlew 스크립트/jar이 없음). 메인 프로젝트 것 재사용:
   ```bash
   cp ../android/gradlew ../android/gradlew.bat wear/ 2>/dev/null
   cp -r ../android/gradle/wrapper/gradle-wrapper.jar wear/gradle/wrapper/
   ```
   (둘 다 Gradle 8.13이라 호환)
3. SDK 경로: `ANDROID_HOME` 환경변수가 있으면 자동. 없으면 `wear/local.properties`에
   `sdk.dir=/path/to/Android/Sdk` 추가.

## 빌드
```bash
cd wear
./gradlew :app:assembleDebug
# 산출물: app/build/outputs/apk/debug/app-debug.apk
```

## 워치에 설치 (갤럭시워치)
1. 워치: 설정 → 개발자 옵션 → ADB 디버깅 / 무선 디버깅 ON
2. 무선: `adb connect <워치-IP>:5555` (워치 무선 디버깅 화면의 IP)
3. 설치: `adb -s <워치-기기> install -r wear/app/build/outputs/apk/debug/app-debug.apk`

## 확인
- 폰 앱 음주모드 ON → 워치 앱 열기 → `0 / 5잔` 보이는지
- 워치 `+1` → 폰 카운트 오르는지
- 폰에서 잔 추가 → 워치 숫자 갱신되는지

## ⚠️ 미검증
이 프로젝트는 워치/빌드 환경에서 **아직 빌드·실행 검증 안 됨**. 버전(AGP 8.5.2 /
Kotlin 2.0.21 / Wear Compose 1.4.0 / compose-bom 2024.09.03)은 합리적 추정치라,
빌드 에러 나면 그 로그를 공유해 주세요 — 버전·의존성 맞춰 수정하겠습니다.

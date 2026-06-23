# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Local Android build

New machine (e.g. Galaxy Book / Windows+WSL2)? Follow `docs/local-build-setup.md` —
toolchain (JDK 21, Android SDK, the mandatory Gradle 8.13 downgrade after every
prebuild), build steps, GitHub-release/OTA distribution, and cross-machine signing.

# 협업 스타일 (오너 선호)

- 한국어로, 캐주얼·비격식 톤으로 소통한다("ㄱㄱ"=진행).
- **검증 전 단정 금지.** "된다/안 된다/끝났다"를 확인 없이 말하지 말 것. 모르면 모른다고,
  추정이면 추정이라고 명시. 기기/권한이 걸린 기능은 실제 동작을 확인하고 말한다.
- 선택지는 명확히 제시하고 "추천"을 표시한다. 장황한 나열보다 추천 + 근거.
- UX 디테일·완성도에 민감하다(실제 폰처럼 보이는 UI, 권한 사유 안내 등).
- 릴리스: `app.json`(version·versionCode) + `src/version.ts` 세 곳을 같은 버전으로 올린 뒤
  로컬 APK 빌드 → GitHub Release. JS만 바뀌었으면 OTA(`eas update`). 자세한 건 위 빌드 가이드.

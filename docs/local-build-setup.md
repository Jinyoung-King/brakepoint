# 로컬 안드로이드 빌드 셋업 (갤럭시북 / 새 기기)

다른 기기(예: 갤럭시북 Windows)에서 이 프로젝트의 APK를 **EAS 없이 로컬**로 빌드하기 위한 셋업.
Windows에서는 **WSL2(Ubuntu)** 를 강력 권장 — 아래 명령·경로가 전부 유닉스식이라 그대로 재현된다.

> 배포는 GitHub Releases(`gh release create`)로 한다. USB/adb 없이도 폰에서 다운로드 설치 가능.

## 0. Windows에 WSL2 + Claude Code

```powershell
# (PowerShell 관리자) WSL2 + Ubuntu 설치
wsl --install -d Ubuntu
```

이후 작업은 전부 Ubuntu(WSL) 셸 안에서 한다. Claude Code도 WSL 안에 설치(`npm i -g @anthropic-ai/claude-code` 또는 공식 설치 스크립트).

## 1. Node / Java

```bash
# Node 20 LTS (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install 20 && nvm use 20

# JDK 21 (Temurin)
sudo apt update && sudo apt install -y wget unzip
# Temurin 21 설치 (adoptium apt repo 또는 sdkman). 예: sdkman
curl -s "https://get.sdkman.io" | bash && source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 21.0.5-tem
```

`~/.bashrc`에 추가:
```bash
export JAVA_HOME="$HOME/.sdkman/candidates/java/current"
```

## 2. Android SDK (command line tools)

```bash
mkdir -p "$HOME/android-sdk/cmdline-tools"
cd "$HOME/android-sdk/cmdline-tools"
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdtools.zip
unzip cmdtools.zip && mv cmdline-tools latest
```

`~/.bashrc`에 추가 후 `exec $SHELL`:
```bash
export ANDROID_HOME="$HOME/android-sdk"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

패키지 설치 + 라이선스 동의:
```bash
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
yes | sdkmanager --licenses
```
> compileSdk는 35. Gradle이 빌드 중 누락 플랫폼을 자동 내려받기도 하지만, 위처럼 미리 깔면 안전하다.

## 3. 레포 클론 + 의존성

```bash
git clone https://github.com/Jinyoung-King/brakepoint.git
cd brakepoint
npm ci      # package-lock 기준 정확히 설치
```

## 4. 로그인 (1회)

```bash
npx eas login           # Expo 계정: jiny.king  (프로젝트 @jiny.king/brakepoint)
gh auth login           # GitHub: 릴리스 업로드용
```

## 5. 빌드 (★ 매번 따르는 순서)

`android/`는 gitignore라 클론 직후엔 없다. prebuild로 생성한다.
**prebuild는 Gradle 래퍼를 9.3.1로 깔고 `local.properties`를 지우므로, prebuild 직후 아래 2개를 매번 다시 적용해야 한다.**

```bash
# (1) 네이티브 프로젝트 생성/동기화
npx expo prebuild -p android --no-install

# (2) Gradle 8.13으로 다운그레이드  ← 안 하면 IBM_SEMERU NoSuchFieldError로 실패
sed -i 's#gradle-9\.[0-9.]*-bin\.zip#gradle-8.13-bin.zip#' \
  android/gradle/wrapper/gradle-wrapper.properties

# (3) SDK 경로 지정
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

# (4) release APK 빌드
cd android && ./gradlew assembleRelease --no-daemon && cd ..
# 결과물: android/app/build/outputs/apk/release/app-release.apk  (~84MB)
```

### 왜 Gradle 8.13인가
이 프로젝트의 AGP 8.x / Kotlin이 Gradle 9에서 제거된 `JvmVendorSpec.IBM_SEMERU`를 참조한다.
prebuild가 까는 Gradle 9.3.1에선 `NoSuchFieldError`로 실패하므로 8.13으로 내린다.

## 6. 배포

### 버전 올리기 (코드/네이티브 변경 시)
- `app.json`의 `expo.version` + `expo.android.versionCode`
- `src/version.ts`의 `APP_VERSION`
세 곳을 같은 버전으로 맞춘 뒤 prebuild→빌드.

### GitHub 릴리스
```bash
cp android/app/build/outputs/apk/release/app-release.apk /tmp/brakepoint-<버전>.apk
gh release create v<버전> /tmp/brakepoint-<버전>.apk --title "v<버전>" --notes "..."
```

### OTA (JS만 바뀐 경우, 네이티브 변경 없이)
```bash
eas update --branch preview --environment preview --message "..." --non-interactive
```
런타임 버전(=app version)이 같은 기존 설치에만 내려간다. 네이티브 변경은 새 APK 필요.

## 서명 / 기기 간 호환
release 빌드는 Expo 템플릿 고정 debug 키스토어로 서명된다(표준 안드로이드 debug 인증서, SHA1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`).
prebuild가 어느 기기에서든 같은 키를 생성하므로, **맥에서 빌드한 APK 위에 갤럭시북 빌드 APK가 그대로 업데이트 설치된다**(지우고 재설치 불필요).
드물게 "서명 충돌/설치 안 됨"이 뜨면 기존 앱 삭제 후 설치.

## 자주 막히는 곳
- prebuild 후 빌드 실패 → 5-(2),(3) 재적용했는지 확인(Gradle 8.13, local.properties).
- `sdkmanager: command not found` → ANDROID_HOME / PATH 확인, 셸 재시작.
- 라이선스 오류 → `yes | sdkmanager --licenses`.
- minSdk 관련 → app.json `expo-build-properties`가 minSdkVersion 26으로 처리(Health Connect 요건). 손대지 말 것.

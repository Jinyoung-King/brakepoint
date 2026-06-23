import { Alert } from 'react-native';

// 시스템 권한 창을 띄우기 전에 "왜/어디에 쓰는지"를 짧게 설명하고 동의를 받는다.
// 안드로이드 권한 창은 자체 설명이 없어서, 맥락 없이 뜨면 사용자가 불쾌할 수 있다.
// "계속"을 누르면 true, 취소/뒤로가기면 false.
export function confirmRationale(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '나중에', style: 'cancel', onPress: () => resolve(false) },
        { text: '계속', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

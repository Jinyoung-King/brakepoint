package expo.modules.fsipermission

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FsiPermissionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("FsiPermission")

    // Android 14(API 34)+ 에서 풀스크린 인텐트 사용 허용 여부.
    // 그 이하 버전은 제한이 없어 항상 true.
    Function("canUseFullScreenIntent") {
      val context = appContext.reactContext
      if (context != null && Build.VERSION.SDK_INT >= 34) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.canUseFullScreenIntent()
      } else {
        true
      }
    }
  }
}

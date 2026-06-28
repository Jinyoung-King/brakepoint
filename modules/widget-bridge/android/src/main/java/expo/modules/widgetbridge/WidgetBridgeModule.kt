package expo.modules.widgetbridge

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// 폰 앱이 현재 잔/한계를 위젯에 반영. prefs에 저장하고 위젯 갱신 브로드캐스트를 보낸다.
class WidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetBridge")

    Function("updateWidget") { count: Double, limit: Int ->
      val ctx = appContext.reactContext ?: return@Function
      val text = if (count % 1.0 == 0.0) count.toInt().toString() else count.toString()
      ctx
        .getSharedPreferences(BrakepointWidgetProvider.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putString("count", text)
        .putInt("limit", limit)
        .apply()

      val manager = AppWidgetManager.getInstance(ctx)
      val component = ComponentName(ctx, BrakepointWidgetProvider::class.java)
      val ids = manager.getAppWidgetIds(component)
      if (ids.isNotEmpty()) {
        val intent = Intent(ctx, BrakepointWidgetProvider::class.java).apply {
          action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(intent)
      }
    }
  }
}

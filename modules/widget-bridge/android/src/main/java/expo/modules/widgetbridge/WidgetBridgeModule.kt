package expo.modules.widgetbridge

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// 폰 앱 ↔ 위젯 다리.
// - updateWidget: 현재 잔/한계를 prefs에 저장하고 위젯 다시 그림.
// - consumePendingAdd: 위젯 "+1"로 쌓인 미반영 횟수를 읽고 0으로 리셋(앱이 흡수).
class WidgetBridgeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("WidgetBridge")

    Function("updateWidget") { count: Double, limit: Int, theme: String ->
      val ctx = appContext.reactContext ?: return@Function
      ctx
        .getSharedPreferences(BrakepointWidgetProvider.PREFS, Context.MODE_PRIVATE)
        .edit()
        .putFloat("countF", count.toFloat())
        .putInt("limit", limit)
        .putString("theme", theme)
        .apply()
      refresh(ctx)
    }

    Function("consumePendingAdd") {
      val ctx = appContext.reactContext ?: return@Function 0
      val prefs = ctx.getSharedPreferences(BrakepointWidgetProvider.PREFS, Context.MODE_PRIVATE)
      val pending = prefs.getInt("pendingAdd", 0)
      if (pending != 0) prefs.edit().putInt("pendingAdd", 0).apply()
      pending
    }
  }

  private fun refresh(ctx: Context) {
    val manager = AppWidgetManager.getInstance(ctx)
    val ids = manager.getAppWidgetIds(ComponentName(ctx, BrakepointWidgetProvider::class.java))
    if (ids.isNotEmpty()) {
      val intent = Intent(ctx, BrakepointWidgetProvider::class.java).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      ctx.sendBroadcast(intent)
    }
  }
}

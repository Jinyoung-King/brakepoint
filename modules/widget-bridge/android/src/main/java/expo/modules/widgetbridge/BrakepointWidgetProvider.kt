package expo.modules.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

// 홈 위젯: 현재 잔/한계를 SharedPreferences에서 읽어 표시. 탭하면 앱 열림.
// 값 갱신은 WidgetBridgeModule.updateWidget()가 prefs 저장 + 갱신 브로드캐스트로 트리거.
class BrakepointWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val count = prefs.getString("count", "0") ?: "0"
    val limit = prefs.getInt("limit", 0)

    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.brakepoint_widget)
      views.setTextViewText(R.id.widget_count, "🍺 $count / ${limit}잔")
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        val pi = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        views.setOnClickPendingIntent(R.id.widget_root, pi)
      }
      manager.updateAppWidget(id, views)
    }
  }

  companion object {
    const val PREFS = "brakepoint_widget"
  }
}

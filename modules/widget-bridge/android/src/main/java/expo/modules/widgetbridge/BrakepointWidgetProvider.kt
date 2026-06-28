package expo.modules.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

// 홈 위젯: 현재 잔/한계 표시 + "+1" 버튼.
// +1 탭 → pendingAdd 누적(낙관적 표시). 실제 카운트 반영은 앱이 다음에 열릴 때
// consumePendingAdd로 흡수(백그라운드 JS 없이 race 없이). 본문 탭 → 앱 열기.
class BrakepointWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val base = prefs.getFloat("countF", 0f)
    val pending = prefs.getInt("pendingAdd", 0)
    val limit = prefs.getInt("limit", 0)
    val shown = base + pending

    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.brakepoint_widget)
      views.setTextViewText(R.id.widget_count, "🍺 ${trim(shown)} / ${limit}잔")

      // 본문 → 앱 열기
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        views.setOnClickPendingIntent(
          R.id.widget_root,
          PendingIntent.getActivity(context, 0, launch, flags()),
        )
      }
      // +1 버튼 → ACTION_ADD 브로드캐스트(자기 자신에게)
      val addIntent = Intent(context, BrakepointWidgetProvider::class.java).setAction(ACTION_ADD)
      views.setOnClickPendingIntent(
        R.id.widget_add,
        PendingIntent.getBroadcast(context, 1, addIntent, flags()),
      )
      manager.updateAppWidget(id, views)
    }
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action == ACTION_ADD) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      prefs.edit().putInt("pendingAdd", prefs.getInt("pendingAdd", 0) + 1).apply()
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, BrakepointWidgetProvider::class.java))
      onUpdate(context, manager, ids)
    }
  }

  private fun flags() = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

  private fun trim(n: Float): String = if (n % 1f == 0f) n.toInt().toString() else n.toString()

  companion object {
    const val PREFS = "brakepoint_widget"
    const val ACTION_ADD = "kr.co.cruxdata.brakepoint.WIDGET_ADD"
  }
}

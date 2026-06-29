package expo.modules.widgetbridge

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.widget.RemoteViews

// 홈 위젯: 둥근 배경 + 현재 잔/한계 + "한계까지" + "+1" 버튼. 색상 테마 선택 가능.
// +1 탭 → pendingAdd 누적(낙관적). 실제 카운트는 앱이 다음에 열릴 때 흡수. 본문 탭 → 앱.
class BrakepointWidgetProvider : AppWidgetProvider() {
  private data class Theme(val bg: Int, val btn: Int, val text: Int, val sub: Int)

  private fun themeOf(name: String): Theme = when (name) {
    "light" -> Theme(R.drawable.widget_bg_light, R.drawable.widget_btn_light, Color.parseColor("#15181f"), Color.parseColor("#5e646e"))
    "blue" -> Theme(R.drawable.widget_bg_blue, R.drawable.widget_btn_blue, Color.parseColor("#eaf2ff"), Color.parseColor("#9bb6db"))
    "pink" -> Theme(R.drawable.widget_bg_pink, R.drawable.widget_btn_pink, Color.parseColor("#ffe9f3"), Color.parseColor("#d49ab8"))
    else -> Theme(R.drawable.widget_bg_dark, R.drawable.widget_btn_dark, Color.parseColor("#f3f5f8"), Color.parseColor("#9aa0ab"))
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val base = prefs.getFloat("countF", 0f)
    val pending = prefs.getInt("pendingAdd", 0)
    val limit = prefs.getInt("limit", 0)
    val theme = themeOf(prefs.getString("theme", "dark") ?: "dark")
    val shown = base + pending
    val over = shown - limit
    val sub = if (over > 0) "한계 초과 +${trim(over)}" else "한계까지 ${trim(limit - shown)}잔"

    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.brakepoint_widget)
      views.setInt(R.id.widget_root, "setBackgroundResource", theme.bg)
      views.setInt(R.id.widget_add, "setBackgroundResource", theme.btn)
      views.setTextColor(R.id.widget_count, theme.text)
      views.setTextColor(R.id.widget_label, theme.sub)
      views.setTextColor(R.id.widget_sub, theme.sub)
      views.setTextViewText(R.id.widget_count, "${trim(shown)} / ${limit}잔")
      views.setTextViewText(R.id.widget_sub, sub)

      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, launch, flags()))
      }
      val addIntent = Intent(context, BrakepointWidgetProvider::class.java).setAction(ACTION_ADD)
      views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getBroadcast(context, 1, addIntent, flags()))
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

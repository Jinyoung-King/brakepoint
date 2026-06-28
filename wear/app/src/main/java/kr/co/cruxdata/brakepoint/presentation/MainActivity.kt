package kr.co.cruxdata.brakepoint.presentation

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableDoubleStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

// 워치 화면: 폰에서 받은 현재 잔/한계 표시 + 큰 +1 버튼(폰으로 "잔 추가" 전송).
class MainActivity : ComponentActivity() {
  private val ADD_PATH = "/brakepoint/add"
  private val STATE_PATH = "/brakepoint/state"
  private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

  private val count = mutableDoubleStateOf(0.0)
  private val limit = mutableIntStateOf(0)

  private val listener = MessageClient.OnMessageReceivedListener { event ->
    if (event.path == STATE_PATH) {
      val parts = String(event.data).split("|")
      parts.getOrNull(0)?.toDoubleOrNull()?.let { count.doubleValue = it }
      parts.getOrNull(1)?.toIntOrNull()?.let { limit.intValue = it }
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      val c by count
      val l by limit
      WearApp(c, l, ::sendAdd)
    }
  }

  override fun onResume() {
    super.onResume()
    Wearable.getMessageClient(this).addListener(listener)
  }

  override fun onPause() {
    super.onPause()
    Wearable.getMessageClient(this).removeListener(listener)
  }

  override fun onDestroy() {
    super.onDestroy()
    scope.cancel()
  }

  // 연결된 폰 노드로 "+1잔" 메시지 전송
  private fun sendAdd() {
    scope.launch(Dispatchers.IO) {
      try {
        val nodes = Tasks.await(Wearable.getNodeClient(this@MainActivity).connectedNodes)
        val client = Wearable.getMessageClient(this@MainActivity)
        for (node in nodes) client.sendMessage(node.id, ADD_PATH, "1".toByteArray())
      } catch (_: Exception) {
        // 무시
      }
    }
  }
}

private fun trimNum(n: Double): String = if (n % 1.0 == 0.0) n.toInt().toString() else n.toString()

@Composable
fun WearApp(count: Double, limit: Int, onAdd: () -> Unit) {
  MaterialTheme {
    Scaffold(timeText = { TimeText() }) {
      Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
      ) {
        Text(text = "${trimNum(count)} / ${limit}잔", style = MaterialTheme.typography.title2)
        Spacer(Modifier.height(10.dp))
        Button(onClick = onAdd, modifier = Modifier.size(68.dp)) {
          Text("+1", fontSize = 24.sp)
        }
      }
    }
  }
}

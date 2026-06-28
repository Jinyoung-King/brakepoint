package expo.modules.wearbridge

import androidx.core.os.bundleOf
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// 폰 쪽 Wear 브리지. 워치에서 온 "+1잔" 메시지를 JS 이벤트로 올리고,
// 현재 상태(잔/한계/BAC)를 워치로 내려보낸다. (Play Services Wearable Message API)
class WearBridgeModule : Module() {
  private val ADD_PATH = "/brakepoint/add" // 워치 → 폰: 잔 추가
  private val STATE_PATH = "/brakepoint/state" // 폰 → 워치: 현재 상태

  private val listener = MessageClient.OnMessageReceivedListener { event ->
    if (event.path == ADD_PATH) {
      val n = String(event.data).toDoubleOrNull() ?: 1.0
      sendEvent("onAddDrink", bundleOf("n" to n))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WearBridge")
    Events("onAddDrink")

    OnCreate {
      appContext.reactContext?.let { Wearable.getMessageClient(it).addListener(listener) }
    }
    OnDestroy {
      appContext.reactContext?.let { Wearable.getMessageClient(it).removeListener(listener) }
    }

    // 현재 상태를 연결된 모든 워치 노드로 전송. (백그라운드 스레드에서 노드 조회)
    AsyncFunction("sendState") { count: Double, limit: Int, bac: Double ->
      val ctx = appContext.reactContext ?: return@AsyncFunction
      val payload = "$count|$limit|$bac".toByteArray()
      val nodes = Tasks.await(Wearable.getNodeClient(ctx).connectedNodes)
      val client = Wearable.getMessageClient(ctx)
      for (node in nodes) client.sendMessage(node.id, STATE_PATH, payload)
    }
  }
}

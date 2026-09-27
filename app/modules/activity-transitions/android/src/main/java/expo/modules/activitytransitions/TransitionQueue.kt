package expo.modules.activitytransitions

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * The file between the receiver and the app (D-094): one JSON object per line.
 *
 * Synchronised, because the receiver and a drain can run at once. Capped, so a
 * phone that records transitions for months without the app ever draining them
 * cannot grow a file without bound: transitions are a handful a day, so the cap
 * is weeks of them, and the oldest go first.
 */
object TransitionQueue {
  private const val FILE = "activity-transitions.jsonl"
  private const val MAX_LINES = 5000

  @Synchronized
  fun append(context: Context, lines: List<String>) {
    if (lines.isEmpty()) return
    val file = File(context.filesDir, FILE)
    file.appendText(lines.joinToString(separator = "\n", postfix = "\n"))
    val all = file.readLines()
    if (all.size > MAX_LINES) {
      file.writeText(all.takeLast(MAX_LINES).joinToString(separator = "\n", postfix = "\n"))
    }
  }

  @Synchronized
  fun drain(context: Context): List<Map<String, Any>> {
    val file = File(context.filesDir, FILE)
    if (!file.exists()) return emptyList()
    val lines = file.readLines()
    file.delete()
    return lines.mapNotNull { line ->
      try {
        val json = JSONObject(line)
        mapOf(
          "ts" to json.getLong("ts").toDouble(),
          "activity" to json.getString("activity"),
          "transition" to json.getString("transition")
        )
      } catch (error: Exception) {
        null
      }
    }
  }
}

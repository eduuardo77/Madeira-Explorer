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
 *
 * ⚠ **And a record of every delivery, kept apart from the queue (2026-09-27).**
 * The first walk with the permission granted left no transition anywhere, and
 * nothing could say whether Android never sent one or the receiver lost it:
 * the receiver logged only failures, to a log that holds about a minute. So
 * every delivery is now counted in `activity-transitions-stats.json`, which a
 * drain does not empty.
 */
object TransitionQueue {
  private const val FILE = "activity-transitions.jsonl"
  private const val STATS = "activity-transitions-stats.json"
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
    val out = lines.mapNotNull { line ->
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
    note(context) { stats -> stats.put("drained", stats.optLong("drained") + out.size) }
    return out
  }

  /** A delivery reached the receiver, with or without a transition result. */
  fun noteDelivery(context: Context, hadResult: Boolean, events: Int) {
    note(context) { stats ->
      stats.put("deliveries", stats.optLong("deliveries") + 1)
      if (!hadResult) stats.put("withoutResult", stats.optLong("withoutResult") + 1)
      stats.put("events", stats.optLong("events") + events)
      stats.put("lastDeliveryTs", System.currentTimeMillis())
    }
  }

  /** Registration succeeded or failed, and when. */
  fun noteRegistration(context: Context, ok: Boolean, reason: String) {
    note(context) { stats ->
      stats.put(if (ok) "lastRegisteredTs" else "lastRefusedTs", System.currentTimeMillis())
      if (!ok) stats.put("lastRefusal", reason)
    }
  }

  @Synchronized
  fun stats(context: Context): Map<String, Any> {
    val json = read(context)
    val out = mutableMapOf<String, Any>()
    for (key in json.keys()) {
      val value = json.get(key)
      out[key] = if (value is Number) value.toDouble() else value.toString()
    }
    return out
  }

  @Synchronized
  private fun note(context: Context, change: (JSONObject) -> Unit) {
    try {
      val json = read(context)
      change(json)
      File(context.filesDir, STATS).writeText(json.toString())
    } catch (error: Exception) {
      // Diagnostics must never cost a transition.
    }
  }

  private fun read(context: Context): JSONObject {
    val file = File(context.filesDir, STATS)
    return try {
      if (file.exists()) JSONObject(file.readText()) else JSONObject()
    } catch (error: Exception) {
      JSONObject()
    }
  }
}

package expo.modules.activitytransitions

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity
import org.json.JSONObject

/**
 * Receives activity transitions from Play services and queues them (D-094).
 * Runs whether or not the app's JavaScript does; see ActivityTransitionsModule.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (!ActivityTransitionResult.hasResult(intent)) return
    val result = ActivityTransitionResult.extractResult(intent) ?: return
    try {
      // Events carry boot-relative time; the database keeps wall-clock epoch
      // milliseconds, like every fix.
      val nowMs = System.currentTimeMillis()
      val nowNanos = SystemClock.elapsedRealtimeNanos()
      val lines = result.transitionEvents.mapNotNull { event ->
        val activity = name(event.activityType) ?: return@mapNotNull null
        JSONObject()
          .put("ts", nowMs - (nowNanos - event.elapsedRealTimeNanos) / 1_000_000)
          .put("activity", activity)
          .put(
            "transition",
            if (event.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER) "enter" else "exit"
          )
          .toString()
      }
      TransitionQueue.append(context, lines)
    } catch (error: Exception) {
      Log.w("Bruma", "activity transition not queued", error)
    }
  }

  /** The names the database's `activity_type` column uses. */
  private fun name(type: Int): String? = when (type) {
    DetectedActivity.STILL -> "still"
    DetectedActivity.WALKING -> "walking"
    DetectedActivity.RUNNING -> "running"
    DetectedActivity.ON_BICYCLE -> "cycling"
    DetectedActivity.IN_VEHICLE -> "driving"
    else -> null
  }
}

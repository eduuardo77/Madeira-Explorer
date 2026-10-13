package expo.modules.activitytransitions

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import android.hardware.TriggerEvent
import android.hardware.TriggerEventListener
import android.os.Bundle
import android.util.Log
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity
import expo.modules.interfaces.taskManager.TaskConsumer
import expo.modules.interfaces.taskManager.TaskConsumerInterface
import expo.modules.interfaces.taskManager.TaskInterface
import expo.modules.interfaces.taskManager.TaskManagerUtilsInterface

/**
 * The motion wake (D-106): tells the app's JavaScript the phone has started to
 * move, so the recorder can leave its stationary profile at once.
 *
 * WHY
 * ---
 * Polling for a position while the phone sits still either missed whole trips
 * (Wi-Fi and cell, the drive to Funchal on 12 Oct 2026) or drew Huawei's
 * battery warning (the GPS every 5 minutes, 38 starts in a night). The P30's
 * significant-motion sensor fired at the start of all three trips the app
 * slept through, while the app kept polling.
 *
 * TWO TRIGGERS, EACH ENOUGH ON ITS OWN
 * ------------------------------------
 * 1. **The significant-motion sensor:** a hardware wake-up sensor in the
 *    phone's low-power chip. One-shot, so it is re-armed after each event. No
 *    permission. About 3 to 4 events a day on the lead's phone.
 * 2. **Google's activity updates:** walking, running, cycling or in a vehicle,
 *    with the "Physical activity" permission. Paused by Play services while
 *    the phone is still, so a still phone costs nothing.
 *
 * Either one runs the JavaScript task, which takes a GPS position and lets the
 * sampling gate decide (`recording/motionWake.ts`). The two can fire together;
 * `MIN_GAP_MS` keeps that to one wake.
 *
 * HOW IT LIVES
 * ------------
 * An Expo task consumer, like expo-location's: `TaskService` keeps it in the
 * app's process (held up by the recorder's foreground service) and restores it
 * whenever the process starts, so the triggers are re-armed with no screen.
 */
class MotionWakeTaskConsumer(context: Context, taskManagerUtils: TaskManagerUtilsInterface?) :
  TaskConsumer(context, taskManagerUtils), TaskConsumerInterface {

  private var task: TaskInterface? = null
  private var trigger: TriggerEventListener? = null
  private var lastWakeMs = 0L

  override fun taskType(): String = "motionWake"

  override fun didRegister(task: TaskInterface) {
    this.task = task
    armSignificantMotion()
    requestActivityUpdates()
  }

  override fun didUnregister() {
    disarmSignificantMotion()
    removeActivityUpdates()
    task = null
  }

  /** Activity updates arrive here, through the task's broadcast intent. */
  override fun didReceiveBroadcast(intent: Intent) {
    if (!ActivityRecognitionResult.hasResult(intent)) return
    val best = ActivityRecognitionResult.extractResult(intent)?.mostProbableActivity ?: return
    val activity = movingName(best.type) ?: return
    if (best.confidence < MIN_CONFIDENCE) return
    wake("activity", activity)
  }

  private fun wake(source: String, activity: String?) {
    val now = System.currentTimeMillis()
    if (now - lastWakeMs < MIN_GAP_MS) return
    lastWakeMs = now
    val current = task ?: return
    val data = Bundle().apply {
      putString("source", source)
      if (activity != null) putString("activity", activity)
      putDouble("ts", now.toDouble())
    }
    context?.let { TransitionQueue.noteWake(it, source) }
    try {
      current.execute(data, null)
    } catch (error: Exception) {
      Log.w(TAG, "motion wake not run", error)
    }
  }

  private fun armSignificantMotion() {
    val ctx = context ?: return
    val manager = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
    val sensor = manager.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION) ?: return
    disarmSignificantMotion()
    val listener = object : TriggerEventListener() {
      override fun onTrigger(event: TriggerEvent?) {
        wake("significant_motion", null)
        // One-shot: it disarms itself on firing.
        if (trigger === this) manager.requestTriggerSensor(this, sensor)
      }
    }
    trigger = listener
    manager.requestTriggerSensor(listener, sensor)
  }

  private fun disarmSignificantMotion() {
    val ctx = context ?: return
    val manager = ctx.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
    val sensor = manager.getDefaultSensor(Sensor.TYPE_SIGNIFICANT_MOTION)
    val listener = trigger
    trigger = null
    if (listener != null && sensor != null) manager.cancelTriggerSensor(listener, sensor)
  }

  private fun requestActivityUpdates() {
    val ctx = context ?: return
    val current = task ?: return
    if (!ActivityTransitionsModule.hasPermission(ctx)) return
    val intent = taskManagerUtils?.createTaskIntent(ctx, current) ?: return
    try {
      ActivityRecognition.getClient(ctx).requestActivityUpdates(ACTIVITY_INTERVAL_MS, intent)
    } catch (error: SecurityException) {
      Log.w(TAG, "activity updates refused", error)
    }
  }

  private fun removeActivityUpdates() {
    val ctx = context ?: return
    val current = task ?: return
    val intent = taskManagerUtils?.createTaskIntent(ctx, current) ?: return
    try {
      ActivityRecognition.getClient(ctx).removeActivityUpdates(intent)
    } catch (error: SecurityException) {
      Log.w(TAG, "activity updates not removed", error)
    }
  }

  companion object {
    private const val TAG = "BrumaMotionWake"

    /** Play services pauses updates while the phone is still, so this costs nothing then. */
    private const val ACTIVITY_INTERVAL_MS = 30_000L

    /** Google's own threshold for a label it is fairly sure of. */
    private const val MIN_CONFIDENCE = 70

    /** One wake at most this often, whichever trigger fires: the JS checks take ~3 min. */
    private const val MIN_GAP_MS = 4 * 60_000L

    private fun movingName(type: Int): String? = when (type) {
      DetectedActivity.WALKING, DetectedActivity.ON_FOOT -> "walking"
      DetectedActivity.RUNNING -> "running"
      DetectedActivity.ON_BICYCLE -> "cycling"
      DetectedActivity.IN_VEHICLE -> "driving"
      else -> null
    }
  }
}

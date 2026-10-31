package expo.modules.activitytransitions

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.util.Log

/**
 * The motion wake's waits, kept by Android (T-295).
 *
 * WHY
 * ---
 * The wake looks three times, 90 s apart, and the still check (T-286) takes
 * a second position five minutes after the first. Both waited on JavaScript
 * timers, and React Native stops its timers while the app is in the
 * background unless a headless task is running; Expo's background tasks are
 * not one. On 31 Oct 2026 a still check begun at 09:00 never got its second
 * position, and the P30 stayed on *driving* through every stop of the morning.
 *
 * An alarm runs the motion task again with a step (`look:1`, `look:2`,
 * `still`), and the JavaScript does the next part (`backgroundTasks.ts`).
 * Exact where the phone allows it without a permission (Android 6 to 11, or
 * the exact-alarm permission granted); otherwise Android's inexact alarm,
 * which may come some minutes late. The still check then stays put
 * (`STILL_CHECK_LATE_MS`), costing battery, never trace.
 */
object FollowUpAlarm {
  private const val TAG = "BrumaFollowUp"
  private const val ACTION = "expo.modules.activitytransitions.FOLLOW_UP"
  const val EXTRA_STEP = "step"

  /** Schedule `step` in `delayMs`, replacing one of the same kind. False when it cannot. */
  fun schedule(context: Context, delayMs: Long, step: String): Boolean {
    val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return false
    val intent = Intent(context, FollowUpReceiver::class.java)
      .setAction(ACTION)
      .putExtra(EXTRA_STEP, step)
    // One alarm per kind: a later look replaces an earlier one, a still check
    // never replaces a look.
    val requestCode = if (step.startsWith("look")) 7101 else 7102
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    val pending = PendingIntent.getBroadcast(context, requestCode, intent, flags)
    val at = SystemClock.elapsedRealtime() + delayMs.coerceAtLeast(0L)
    return try {
      val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
      when {
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M ->
          manager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending)
        exact -> manager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending)
        else -> manager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pending)
      }
      true
    } catch (error: SecurityException) {
      Log.w(TAG, "follow-up not scheduled", error)
      false
    }
  }
}

/** Where the alarm lands: hands the step to the motion task, if it is registered. */
class FollowUpReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val step = intent.getStringExtra(FollowUpAlarm.EXTRA_STEP) ?: return
    if (!MotionWakeTaskConsumer.followUp(step)) {
      // The process restarted and the task is not restored yet, or the motion
      // wake was switched off. A still check left behind is replaced by the
      // next one (`canStartStillCheck`), and a relaunch starts on stationary.
      Log.w("BrumaFollowUp", "follow-up $step dropped: no motion task")
    }
  }
}

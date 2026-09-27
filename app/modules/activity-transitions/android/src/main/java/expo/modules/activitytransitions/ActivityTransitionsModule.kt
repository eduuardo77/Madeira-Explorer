package expo.modules.activitytransitions

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.DetectedActivity
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android's activity transitions for Bruma (D-094): still, walking, running,
 * cycling, in a vehicle.
 *
 * WHY TRANSITIONS, NOT A STREAM
 * -----------------------------
 * The Activity Transition API reports only changes, from the phone's low-power
 * motion sensors, and wakes nobody in between. A periodic activity stream would
 * cost a wake-up every interval all day for a signal that changes a handful of
 * times. The app needs to know what the user was doing at the time of each fix,
 * and the last change before it answers that.
 *
 * WHY A FILE
 * ----------
 * Android delivers a transition to `ActivityTransitionReceiver` whether or not
 * the app's JavaScript is running, and a receiver cannot reach the app's
 * database safely (expo-sqlite owns that connection). So transitions are queued
 * in `files/activity-transitions.jsonl` and the recorder drains them into the
 * database on its next batch (`recording/activityRecognition.ts`), the way the
 * update notice already talks between native and JavaScript (T-210).
 */
class ActivityTransitionsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ActivityTransitions")

    /** Google Play services is present and current enough. */
    Function("isAvailable") {
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) ==
        ConnectionResult.SUCCESS
    }

    /** The "Physical activity" permission is granted (always, before Android 10). */
    Function("hasPermission") {
      hasPermission(context)
    }

    /**
     * Register for transitions. Idempotent: registering again with the same
     * PendingIntent replaces the earlier request. Resolves false, never
     * rejects, when it cannot: no permission, no Play services.
     */
    AsyncFunction("start") { promise: Promise ->
      val ctx = context
      if (!hasPermission(ctx)) {
        TransitionQueue.noteRegistration(ctx, false, "no permission")
        promise.resolve(false)
        return@AsyncFunction
      }
      try {
        ActivityRecognition.getClient(ctx)
          .requestActivityTransitionUpdates(request(), pendingIntent(ctx))
          .addOnSuccessListener {
            TransitionQueue.noteRegistration(ctx, true, "")
            promise.resolve(true)
          }
          .addOnFailureListener { error ->
            TransitionQueue.noteRegistration(ctx, false, error.toString())
            promise.resolve(false)
          }
      } catch (error: SecurityException) {
        TransitionQueue.noteRegistration(ctx, false, error.toString())
        promise.resolve(false)
      }
    }

    /**
     * What has happened since install: deliveries, events, drains,
     * registrations. Never emptied by a drain (see TransitionQueue).
     */
    Function("diagnostics") {
      TransitionQueue.stats(context)
    }

    AsyncFunction("stop") { promise: Promise ->
      try {
        ActivityRecognition.getClient(context)
          .removeActivityTransitionUpdates(pendingIntent(context))
          .addOnSuccessListener { promise.resolve(true) }
          .addOnFailureListener { promise.resolve(false) }
      } catch (error: SecurityException) {
        promise.resolve(false)
      }
    }

    /**
     * Every transition queued since the last drain, oldest first, and the queue
     * emptied. Each is { ts, activity, transition }.
     */
    Function("drain") {
      TransitionQueue.drain(context)
    }
  }

  companion object {
    private const val ACTION = "expo.modules.activitytransitions.TRANSITION"

    fun hasPermission(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        return true
      }
      return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.ACTIVITY_RECOGNITION
      ) == PackageManager.PERMISSION_GRANTED
    }

    private fun request(): ActivityTransitionRequest {
      val activities = listOf(
        DetectedActivity.STILL,
        DetectedActivity.WALKING,
        DetectedActivity.RUNNING,
        DetectedActivity.ON_BICYCLE,
        DetectedActivity.IN_VEHICLE
      )
      val transitions = activities.flatMap { activity ->
        listOf(
          ActivityTransition.ACTIVITY_TRANSITION_ENTER,
          ActivityTransition.ACTIVITY_TRANSITION_EXIT
        ).map { kind ->
          ActivityTransition.Builder()
            .setActivityType(activity)
            .setActivityTransition(kind)
            .build()
        }
      }
      return ActivityTransitionRequest(transitions)
    }

    private fun pendingIntent(context: Context): PendingIntent {
      val intent = Intent(context, ActivityTransitionReceiver::class.java).setAction(ACTION)
      // Mutable: Play services writes the transition result into the intent.
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      return PendingIntent.getBroadcast(context, 0, intent, flags)
    }
  }
}

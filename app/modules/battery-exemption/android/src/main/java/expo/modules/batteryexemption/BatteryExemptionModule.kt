package expo.modules.batteryexemption

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Asking Android not to pause Bruma to save battery (T-250).
 *
 * Two things Expo does not offer, and the reason this module exists:
 *
 *  - **Reading the answer.** `PowerManager.isIgnoringBatteryOptimizations` says
 *    whether the app is exempt. Without it, first run could only open a
 *    settings list and never know what happened (`batteryOptimisation.ts`).
 *  - **The one-tap dialog.** `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
 *    needs the app's package as the intent's data, which `Linking.sendIntent`
 *    cannot set. It is started for a result so the promise settles when the
 *    user has answered, not when the dialog opens.
 *
 * Never rejects: every failure resolves `unavailable`, and the caller falls back
 * to the settings list. First run must never stop on this (D-008).
 */
class BatteryExemptionModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** The answer the dialog is waiting on, if one is open. */
  private var pending: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("BatteryExemption")

    /** Android will not pause this app for battery optimisation. */
    Function("isExempt") {
      isExempt(context)
    }

    /**
     * Show the one-tap dialog. Resolves `exempt` or `declined` once answered,
     * `exempt` at once when it already is, `unavailable` when it cannot ask.
     */
    AsyncFunction("request") { promise: Promise ->
      val ctx = context
      if (isExempt(ctx)) {
        promise.resolve("exempt")
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve("unavailable")
        return@AsyncFunction
      }
      // A second ask while one is open answers the first: never leave a
      // promise hanging (T-250's guard against double taps, native side).
      pending?.resolve(if (isExempt(ctx)) "exempt" else "declined")
      pending = promise
      try {
        @SuppressLint("BatteryLife")
        val intent = Intent(
          Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
          Uri.parse("package:" + ctx.packageName)
        )
        activity.startActivityForResult(intent, REQUEST_CODE)
      } catch (error: Exception) {
        pending = null
        promise.resolve("unavailable")
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val waiting = pending ?: return@OnActivityResult
      pending = null
      // Read the state rather than trust the result code: some OEM dialogs
      // return CANCELED whatever was tapped.
      waiting.resolve(if (isExempt(context)) "exempt" else "declined")
    }
  }

  private fun isExempt(ctx: Context): Boolean {
    val power = ctx.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
    return power.isIgnoringBatteryOptimizations(ctx.packageName)
  }

  companion object {
    private const val REQUEST_CODE = 0xB417
  }
}

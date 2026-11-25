package expo.modules.videoexport

import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import java.io.File

/**
 * The gallery side of the video you keep (T-329, D-112).
 *
 * One video per trip: saving the same trip again writes over the file the app
 * made before (`replace`), so trying the choices never fills the gallery. An
 * app may write to the MediaStore files it created without asking, on Android
 * 10 and later. If that file is gone (deleted, moved), a new one is made.
 *
 * Android 9 and earlier would need the storage permission to reach the
 * gallery, which the app does not hold: there the video is shared, not saved
 * (`save` returns null).
 */
object Gallery {
  /** The saved video's address, and whether it replaced the one before; null when this Android cannot save. */
  fun save(context: Context, file: File, displayName: String, folder: String, replace: Uri?): Pair<Uri, Boolean>? {
    if (Build.VERSION.SDK_INT < 29) return null
    val resolver = context.contentResolver
    if (replace != null) {
      try {
        resolver.openOutputStream(replace, "wt")?.use { out -> file.inputStream().use { it.copyTo(out) } }
          ?: throw IllegalStateException("no stream")
        return Pair(replace, true)
      } catch (e: Exception) {
        // Gone, or no longer ours: make a new one.
      }
    }
    val values = ContentValues().apply {
      put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
      put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
      put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/$folder")
      put(MediaStore.Video.Media.IS_PENDING, 1)
    }
    val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values) ?: throw IllegalStateException("gallery refused the video")
    resolver.openOutputStream(uri)!!.use { out -> file.inputStream().use { it.copyTo(out) } }
    values.clear()
    values.put(MediaStore.Video.Media.IS_PENDING, 0)
    resolver.update(uri, values, null, null)
    return Pair(uri, false)
  }

  /** Android's share sheet with the video. */
  fun share(activity: Activity, uri: Uri, title: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
      type = "video/mp4"
      putExtra(Intent.EXTRA_STREAM, uri)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    activity.startActivity(Intent.createChooser(send, title))
  }

  /** The phone's own player, from the gallery. */
  fun open(activity: Activity, uri: Uri) {
    activity.startActivity(Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "video/mp4")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    })
  }
}

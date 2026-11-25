package expo.modules.videoexport

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/**
 * The video you keep, seen and made (T-329, D-112), on a 3D map.
 *
 * MapLibre Android has no 3D terrain, and the lead asked for the relief (25 Nov
 * 2026). So the video is drawn and encoded by a page, `assets/video3d/`, with
 * MapLibre GL JS in this WebView: the preview is the page playing, saving is
 * the page encoding with the phone's video encoder (WebCodecs) and handing the
 * MP4 back in pieces, which this view puts in the gallery (`Gallery`).
 *
 * The page and the app's map files (`mapAssets.ts`, under the cache) are served
 * from `https://bruma.local/`, a name only this WebView answers: nothing leaves
 * the phone, and the page reads the files as same-origin fetches.
 *
 * What shows and when is all in the job (`app/src/souvenir/videoJob.ts`).
 */
@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
class BrumaVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onReady by EventDispatcher<Map<String, Any>>()
  private val onProgress by EventDispatcher<Map<String, Any>>()

  private val main = Handler(Looper.getMainLooper())
  private val web = WebView(context)
  @Volatile private var job: String? = null
  @Volatile private var mapStyle: String? = null
  private var playing = false
  private var pageLoaded = false
  @Volatile private var exporting: Export? = null

  init {
    web.setBackgroundColor(Color.rgb(0x91, 0xD8, 0xEE))
    web.settings.apply {
      javaScriptEnabled = true
      allowFileAccess = false
      allowContentAccess = false
      setSupportZoom(false)
      builtInZoomControls = false
    }
    web.isVerticalScrollBarEnabled = false
    web.isHorizontalScrollBarEnabled = false
    web.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = serve(request.url)
      override fun onPageFinished(view: WebView, url: String) {
        pageLoaded = true
        loadJob()
      }
    }
    web.webChromeClient = object : WebChromeClient() {
      override fun onConsoleMessage(message: ConsoleMessage): Boolean {
        Log.i(TAG, "page: ${message.message()}")
        return true
      }
    }
    web.addJavascriptInterface(Bridge(), "BrumaNative")
    addView(web)
    web.loadUrl("$ORIGIN/assets/video3d/index.html")
  }

  // --- props ---

  fun setJob(json: String?) {
    if (json == job) return
    job = json
    loadJob()
  }

  fun setMapStyle(json: String?) {
    if (json == mapStyle) return
    mapStyle = json
    loadJob()
  }

  fun setPlaying(value: Boolean) {
    playing = value
    if (pageLoaded) web.evaluateJavascript("bruma.play($value)", null)
  }

  /** The page asks for the job, the style and the icon itself (`Bridge`): megabytes do not belong in a script. */
  private fun loadJob() {
    if (!pageLoaded || job == null || mapStyle == null || exporting != null) return
    web.evaluateJavascript("bruma.play($playing); bruma.load(JSON.parse(BrumaNative.job()), JSON.parse(BrumaNative.style()), BrumaNative.icon())", null)
  }

  // --- export ---

  fun export(options: Map<String, Any?>, promise: Promise) {
    if (!pageLoaded || job == null) { promise.reject("ERR_NOT_READY", "the video is not ready", null); return }
    if (exporting != null) { promise.reject("ERR_BUSY", "a video is already being made", null); return }
    exporting = Export(options, promise)
    web.evaluateJavascript("bruma.exportVideo()", null)
  }

  fun cancelExport() {
    if (exporting != null) web.evaluateJavascript("bruma.cancel()", null)
  }

  fun destroy() {
    exporting?.close()
    exporting = null
    web.stopLoading()
    web.destroy()
  }

  /** One video being made: the pieces the page hands over, written to a file, then the gallery. */
  private inner class Export(options: Map<String, Any?>, private val promise: Promise) {
    val file = File(context.cacheDir, "bruma-video.mp4")
    private val out = FileOutputStream(file)
    val displayName = options["displayName"] as? String ?: "video.mp4"
    val folder = options["folder"] as? String ?: "Movies"
    val replace = (options["replaceUri"] as? String)?.let { Uri.parse(it) }
    val startedAt = SystemClock.elapsedRealtime()

    fun write(piece: String) = out.write(Base64.decode(piece, Base64.DEFAULT))

    fun close() = runCatching { out.close() }

    /** Bridge thread: the file into the gallery, then the answer on the main thread. */
    fun finish(meta: JSONObject) {
      close()
      try {
        val saved = Gallery.save(context, file, displayName, folder, replace)
        val ms = SystemClock.elapsedRealtime() - startedAt
        val result = mapOf(
          "uri" to (saved?.first?.toString() ?: Uri.fromFile(file).toString()),
          "saved" to (saved != null),
          "replaced" to (saved?.second ?: false),
          "frames" to meta.optInt("frames"),
          "ms" to ms,
        )
        Log.i(TAG, "export: ${meta.optInt("frames")} frames in $ms ms, ${file.length()} bytes")
        main.post { exporting = null; promise.resolve(result) }
      } catch (e: Exception) {
        main.post { exporting = null; promise.reject("ERR_EXPORT", e.message ?: "the video could not be made", e) }
      }
    }

    fun fail(message: String) {
      close()
      file.delete()
      main.post {
        exporting = null
        if (message == "cancelled") promise.reject("ERR_CANCELLED", "cancelled", null)
        else promise.reject("ERR_EXPORT", message, null)
      }
    }
  }

  /** What the page calls; on a WebView thread, not the main one. */
  private inner class Bridge {
    @JavascriptInterface fun job(): String = job ?: "null"
    @JavascriptInterface fun style(): String = mapStyle ?: "null"
    @JavascriptInterface fun icon(): String = iconUrl

    @JavascriptInterface fun ready() { main.post { onReady(mapOf("ready" to true)) } }
    @JavascriptInterface fun progress(done: Int, total: Int) { main.post { onProgress(mapOf("done" to done, "total" to total)) } }
    @JavascriptInterface fun chunk(piece: String) { exporting?.write(piece) }
    @JavascriptInterface fun done(meta: String) { exporting?.finish(JSONObject(meta)) }
    @JavascriptInterface fun failed(message: String) {
      Log.w(TAG, "page failed: $message")
      exporting?.fail(message)
    }
    @JavascriptInterface fun log(message: String) { Log.i(TAG, "page: $message") }
  }

  // --- the page's files ---

  /** `https://bruma.local/assets/…` from the app's assets, `/cache/…` from its cache (the map files). */
  private fun serve(url: Uri): WebResourceResponse? {
    if (url.host != HOST) return null
    val path = url.path ?: return notFound()
    return try {
      when {
        path.startsWith("/assets/") -> response(path, context.assets.open(path.removePrefix("/assets/")))
        path.startsWith("/cache/") -> {
          val root = context.cacheDir.canonicalFile
          val file = File(root, path.removePrefix("/cache/")).canonicalFile
          if (!file.path.startsWith(root.path + File.separator) || !file.isFile) notFound() else response(path, file.inputStream())
        }
        else -> notFound()
      }
    } catch (e: java.io.IOException) {
      notFound()
    }
  }

  private fun response(path: String, stream: java.io.InputStream): WebResourceResponse {
    val mime = when (path.substringAfterLast('.', "")) {
      "html" -> "text/html"
      "js" -> "application/javascript"
      "json" -> "application/json"
      "pbf" -> "application/x-protobuf"
      else -> "application/octet-stream"
    }
    val text = mime.startsWith("text") || mime.endsWith("javascript")
    return WebResourceResponse(mime, if (text) "utf-8" else null, 200, "OK", mapOf("Cache-Control" to "no-store"), stream)
  }

  private fun notFound() = WebResourceResponse("text/plain", "utf-8", 404, "Not Found", emptyMap(), "".byteInputStream())

  /** The app's icon for the end card, as a data URL. */
  private val iconUrl: String by lazy {
    runCatching {
      val drawable = context.packageManager.getApplicationIcon(context.applicationInfo)
      val bitmap = if (drawable is BitmapDrawable) drawable.bitmap else Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888).also {
        val canvas = Canvas(it)
        drawable.setBounds(0, 0, 192, 192)
        drawable.draw(canvas)
      }
      val bytes = ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
      "data:image/png;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
    }.getOrDefault("")
  }

  // --- layout: React Native does not lay out a native view's children ---

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    web.measure(MeasureSpec.makeMeasureSpec(r - l, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(b - t, MeasureSpec.EXACTLY))
    web.layout(0, 0, r - l, b - t)
  }

  private val relayout = Runnable {
    measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY))
    layout(left, top, right, bottom)
  }

  override fun requestLayout() { super.requestLayout(); post(relayout) }

  private companion object {
    const val TAG = "BrumaVideo"
    const val HOST = "bruma.local"
    const val ORIGIN = "https://$HOST"
  }
}

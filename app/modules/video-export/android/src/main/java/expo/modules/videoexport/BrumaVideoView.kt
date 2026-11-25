package expo.modules.videoexport

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Choreographer
import android.view.View
import android.widget.FrameLayout
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import java.io.File
import java.util.concurrent.Executors

/**
 * The video you keep, seen and made (T-329, D-112).
 *
 * One view does both, so what is seen is what is saved:
 *
 *   - **Preview.** A MapLibre map at the video's full size (1080 x 1920), shown
 *     scaled down, its camera moved to the frame of the moment; the roads and
 *     the overlay drawn above it at screen size, by the same painters.
 *   - **Export.** The same map, frame by frame: move the camera, wait
 *     `SETTLE_FRAMES` screen refreshes, take its picture; a worker draws the
 *     roads and the overlay at full size and hands the frame to the encoder,
 *     while the map draws the next. Measured on the P30 in `tools/video-spike/`
 *     (71 s for 20.4 s of video). Saved to the gallery, over the trip's last
 *     video when there is one (`Gallery`).
 *
 * What shows and when is all in the job (`app/src/souvenir/videoJob.ts`).
 */
class BrumaVideoView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onReady by EventDispatcher<Map<String, Any>>()
  private val onProgress by EventDispatcher<Map<String, Any>>()

  private var job: VideoJob? = null
  private var mapStyle: String? = null
  private var map: MapLibreMap? = null
  private var styleLoaded = false
  private var playing = false
  private var exporting: Export? = null

  private val stage = FrameLayout(context)
  private val mapView: MapView
  private val overlayView = OverlayView(context)
  private val icon: Bitmap? = appIcon(context)

  init {
    MapLibre.getInstance(context)
    val options = MapLibreMapOptions.createFromAttributes(context, null).pixelRatio(PIXEL_RATIO).textureMode(true)
    mapView = MapView(context, options)
    stage.addView(mapView, FrameLayout.LayoutParams(FULL_W, FULL_H))
    addView(stage)
    addView(overlayView)
    clipChildren = true
    mapView.onCreate(null)
    mapView.onStart()
    mapView.onResume()
    mapView.getMapAsync { m ->
      map = m
      m.uiSettings.setAllGesturesEnabled(false)
      m.uiSettings.isLogoEnabled = false
      m.uiSettings.isAttributionEnabled = false
      m.uiSettings.isCompassEnabled = false
      applyStyle()
    }
  }

  // --- props ---

  fun setJob(json: String?) {
    job = json?.let { VideoJob.parse(it) }
    overlayView.rebuild()
    startedAt = SystemClock.elapsedRealtime()
    showFrame(0)
  }

  fun setMapStyle(json: String?) {
    if (json == mapStyle) return
    mapStyle = json
    styleLoaded = false
    applyStyle()
  }

  fun setPlaying(value: Boolean) {
    playing = value
    if (value) { startedAt = SystemClock.elapsedRealtime() - pausedAtMs; tick() } else pausedAtMs = SystemClock.elapsedRealtime() - startedAt
  }

  private fun applyStyle() {
    val m = map ?: return
    val style = mapStyle ?: return
    m.setStyle(Style.Builder().fromJson(style)) {
      styleLoaded = true
      showFrame(currentFrame)
      onReady(mapOf("ready" to true))
      if (playing) tick()
    }
  }

  // --- preview ---

  private var startedAt = 0L
  private var pausedAtMs = 0L
  private var currentFrame = 0
  private var ticking = false

  private fun tick() {
    if (ticking) return
    ticking = true
    Choreographer.getInstance().postFrameCallback(object : Choreographer.FrameCallback {
      override fun doFrame(frameTimeNanos: Long) {
        val j = job
        if (!playing || exporting != null || j == null || !styleLoaded || !isAttachedToWindow) { ticking = false; return }
        val elapsed = SystemClock.elapsedRealtime() - startedAt
        // The preview loops; a slow frame drops frames, it never slows the clock.
        showFrame(((elapsed * j.fps / 1000) % j.frames.size).toInt())
        Choreographer.getInstance().postFrameCallback(this)
      }
    })
  }

  private fun showFrame(index: Int) {
    val j = job ?: return
    val m = map ?: return
    if (j.frames.isEmpty()) return
    currentFrame = index.coerceIn(0, j.frames.size - 1)
    val f = j.frames[currentFrame]
    m.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(f[2], f[1])).zoom(f[3]).build()))
    overlayView.invalidate()
  }

  /** The roads and the overlay at screen size, over the scaled-down map. */
  private inner class OverlayView(context: Context) : View(context) {
    private var roads: RoadPainter? = null
    private var overlay: OverlayPainter? = null

    fun rebuild() {
      val j = job
      if (j == null || width == 0) { roads = null; overlay = null; return }
      val r = j.ratio * width / j.outW
      roads = RoadPainter(j.strokes, width, height, r)
      overlay = OverlayPainter(width, height, r, j.appName, j.glyph, icon)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) = rebuild()

    override fun onDraw(canvas: Canvas) {
      val j = job ?: return
      if (!styleLoaded || j.frames.isEmpty()) return
      val f = j.frames[currentFrame]
      val roads = roads ?: return
      roads.paint(canvas, f[0], f[1], f[2], f[3])
      overlay?.paint(canvas, j.overlays.getJSONObject(currentFrame)) { lon, lat, out -> roads.project(lon, lat, f[1], f[2], f[3], out) }
    }
  }

  // --- layout: the map at full size, shown scaled; the overlay at screen size ---

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), MeasureSpec.getSize(heightMeasureSpec))
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    val w = r - l
    val h = b - t
    stage.measure(MeasureSpec.makeMeasureSpec(FULL_W, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(FULL_H, MeasureSpec.EXACTLY))
    stage.layout(0, 0, FULL_W, FULL_H)
    stage.pivotX = 0f
    stage.pivotY = 0f
    stage.scaleX = w.toFloat() / FULL_W
    stage.scaleY = h.toFloat() / FULL_H
    overlayView.measure(MeasureSpec.makeMeasureSpec(w, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(h, MeasureSpec.EXACTLY))
    overlayView.layout(0, 0, w, h)
  }

  // React Native does not lay out views it did not create; do it ourselves.
  private val relayout = Runnable { measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)); layout(left, top, right, bottom) }
  override fun requestLayout() { super.requestLayout(); post(relayout) }

  // --- export ---

  fun export(options: Map<String, Any?>, promise: Promise) {
    val j = job
    val m = map
    if (j == null || m == null || !styleLoaded) { promise.reject("ERR_NOT_READY", "the video is not ready", null); return }
    if (exporting != null) { promise.reject("ERR_BUSY", "a video is already being made", null); return }
    val export = Export(j, m, options, promise)
    exporting = export
    export.start()
  }

  fun cancelExport() { exporting?.cancelled = true }

  fun destroy() {
    exporting?.cancelled = true
    playing = false
    mapView.onPause(); mapView.onStop(); mapView.onDestroy()
  }

  private inner class Export(private val j: VideoJob, private val m: MapLibreMap, options: Map<String, Any?>, private val promise: Promise) {
    @Volatile var cancelled = false
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val file = File(context.cacheDir, "bruma-video.mp4")
    private val displayName = options["displayName"] as? String ?: "${j.appName}.mp4"
    private val folder = options["folder"] as? String ?: j.appName
    private val replace = (options["replaceUri"] as? String)?.let { Uri.parse(it) }
    private val roads = RoadPainter(j.strokes, j.outW, j.outH, j.ratio)
    private val overlay = OverlayPainter(j.outW, j.outH, j.ratio, j.appName, j.glyph, icon)
    private lateinit var encoder: FrameEncoder
    private var index = 0
    private var inFlight = 0
    private var waiting = false
    private val startedAt = SystemClock.elapsedRealtime()

    fun start() {
      overlayView.visibility = INVISIBLE
      worker.execute { encoder = FrameEncoder(j.outW, j.outH, j.fps, file) }
      next()
    }

    /** Main thread: point the map at the next frame and take its picture once it has settled. */
    private fun next() {
      if (cancelled) { stop(); worker.execute { runCatching { encoder.finish() }; file.delete(); main.post { promise.reject("ERR_CANCELLED", "cancelled", null) } }; return }
      if (index >= j.frames.size) { worker.execute { finish() }; return }
      if (inFlight >= MAX_IN_FLIGHT) { waiting = true; return }
      val f = j.frames[index]
      currentFrame = index
      m.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(f[2], f[1])).zoom(f[3]).build()))
      m.triggerRepaint()
      // MapLibre's idle and rendered-fully signals did not arrive after moveCamera
      // in the spike, so wait a few screen refreshes; the first frame longer.
      var left = if (index == 0) FIRST_SETTLE_FRAMES else SETTLE_FRAMES
      Choreographer.getInstance().postFrameCallback(object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
          if (--left > 0) Choreographer.getInstance().postFrameCallback(this) else m.snapshot { picture -> taken(picture, f) }
        }
      })
    }

    private fun taken(picture: Bitmap, f: DoubleArray) {
      val frameIndex = index
      inFlight += 1
      worker.execute { compose(picture, f, frameIndex) }
      index += 1
      if (index % PROGRESS_EVERY == 0) onProgress(mapOf("done" to index, "total" to j.frames.size))
      main.post { next() }
    }

    /** Worker: roads and overlay onto the picture, then the encoder. */
    private fun compose(picture: Bitmap, f: DoubleArray, frameIndex: Int) {
      val frame = if (picture.isMutable) picture else picture.copy(Bitmap.Config.ARGB_8888, true)
      val canvas = Canvas(frame)
      roads.paint(canvas, f[0], f[1], f[2], f[3])
      overlay.paint(canvas, j.overlays.getJSONObject(frameIndex)) { lon, lat, out -> roads.project(lon, lat, f[1], f[2], f[3], out) }
      encoder.add(frame)
      main.post {
        inFlight -= 1
        if (waiting) { waiting = false; next() }
      }
    }

    /** Worker: close the file, put it in the gallery, answer. */
    private fun finish() {
      try {
        encoder.finish()
        val saved = Gallery.save(context, file, displayName, folder, replace)
        val result = mapOf(
          "uri" to (saved?.first?.toString() ?: Uri.fromFile(file).toString()),
          "saved" to (saved != null),
          "replaced" to (saved?.second ?: false),
          "frames" to j.frames.size,
          "ms" to (SystemClock.elapsedRealtime() - startedAt),
        )
        main.post { stop(); promise.resolve(result) }
      } catch (e: Exception) {
        main.post { stop(); promise.reject("ERR_EXPORT", e.message ?: "the video could not be made", e) }
      }
    }

    private fun stop() {
      worker.shutdown()
      exporting = null
      overlayView.visibility = VISIBLE
      this@BrumaVideoView.startedAt = SystemClock.elapsedRealtime()
      showFrame(0)
      if (playing) tick()
    }
  }

  private companion object {
    /** The video's size, pixels, and points to pixels: 360 x 640 points, as `videoJob.ts`. */
    const val FULL_W = 1080
    const val FULL_H = 1920
    const val PIXEL_RATIO = 3f
    /** Screen refreshes to wait after moving the camera before the picture; the first frame longer, while tiles load. */
    const val SETTLE_FRAMES = 3
    const val FIRST_SETTLE_FRAMES = 60
    /** Pictures waiting for the worker at most: each is 8 MB. */
    const val MAX_IN_FLIGHT = 2
    const val PROGRESS_EVERY = 6

    fun appIcon(context: Context): Bitmap? = runCatching {
      val drawable = context.packageManager.getApplicationIcon(context.applicationInfo)
      if (drawable is BitmapDrawable) drawable.bitmap else {
        val bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, 192, 192)
        drawable.draw(canvas)
        bitmap
      }
    }.getOrNull()
  }
}

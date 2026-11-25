package expo.modules.videoexport

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
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
import java.util.concurrent.atomic.AtomicLong

/**
 * The video you keep, seen and made (T-329, D-112).
 *
 * One view does both, so what is seen is what is saved:
 *
 *   - **Preview.** A MapLibre map at the video's full size (1080 x 1920), shown
 *     scaled down, its camera moved to the frame of the moment; the roads and
 *     the overlay drawn above it at screen size, by the same painters (the
 *     settled road from masks, `RoadPainter.cachePx`).
 *   - **Export.** The same map, frame by frame: move the camera and take its
 *     picture; two composers draw the roads and the overlay at full size, an
 *     encoder thread takes the frames in order, while the map draws the next.
 *     On the P30, 41 s for 20.4 s of the lead's trip (T-329, 25 Nov 2026; 90 s
 *     before). Saved to the gallery, over the trip's last video when there is
 *     one (`Gallery`).
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
    val t0 = SystemClock.elapsedRealtime()
    job = json?.let { VideoJob.parse(it) }
    Log.i(TAG, "job: ${json?.length ?: 0} chars parsed in ${SystemClock.elapsedRealtime() - t0} ms")
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
      roads = RoadPainter(j.strokes, width, height, r, cachePx = PREVIEW_CACHE_PX)
      overlay = OverlayPainter(width, height, r, j.appName, j.glyph, icon)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) = rebuild()

    override fun onDraw(canvas: Canvas) {
      val j = job ?: return
      if (!styleLoaded || j.frames.isEmpty()) return
      val f = j.frames[currentFrame]
      val roads = roads ?: return
      val o = j.overlays.getJSONObject(currentFrame)
      roads.paint(canvas, f[0], f[1], f[2], f[3], o.optDouble("roadGlow", 0.0).toFloat())
      overlay?.paint(canvas, o) { lon, lat, out -> roads.project(lon, lat, f[1], f[2], f[3], out) }
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

  /**
   * Making the video. The main thread moves the map and takes its picture;
   * two composers draw the roads and the overlay, even frames on one and odd
   * on the other, each with its own painters (a painter keeps the road it has
   * drawn and only goes forward); one encoder thread takes the frames back in
   * order. With one worker the roads were 89 ms of a frame on the P30 and
   * held the map back a quarter of the time (T-329, 25 Nov 2026).
   */
  private inner class Export(private val j: VideoJob, private val m: MapLibreMap, options: Map<String, Any?>, private val promise: Promise) {
    @Volatile var cancelled = false
    private val main = Handler(Looper.getMainLooper())
    private val composers = List(COMPOSERS) { Executors.newSingleThreadExecutor() }
    private val painters = List(COMPOSERS) {
      RoadPainter(j.strokes, j.outW, j.outH, j.ratio) to OverlayPainter(j.outW, j.outH, j.ratio, j.appName, j.glyph, icon)
    }
    private val encoding = Executors.newSingleThreadExecutor()
    private val file = File(context.cacheDir, "bruma-video.mp4")
    private val displayName = options["displayName"] as? String ?: "${j.appName}.mp4"
    private val folder = options["folder"] as? String ?: j.appName
    private val replace = (options["replaceUri"] as? String)?.let { Uri.parse(it) }
    private lateinit var encoder: FrameEncoder
    /** Encoder thread only: composed frames waiting their turn, and the next one due. */
    private val ready = HashMap<Int, Bitmap>()
    private var nextToEncode = 0
    private var index = 0
    private var inFlight = 0
    private var waiting = false
    private val startedAt = SystemClock.elapsedRealtime()
    // Where the time goes, ms in all.
    private var settleMs = 0L
    private var snapshotMs = 0L
    private var heldMs = 0L
    private var heldSince = 0L
    private val roadsMs = AtomicLong()
    private val overlayMs = AtomicLong()
    private var encodeMs = 0L

    fun start() {
      overlayView.visibility = INVISIBLE
      encoding.execute { encoder = FrameEncoder(j.outW, j.outH, j.fps, file) }
      next()
    }

    /** Main thread: point the map at the next frame and take its picture once it has drawn it. */
    private fun next() {
      if (cancelled) {
        stop()
        encoding.execute { runCatching { encoder.finish() }; file.delete(); main.post { promise.reject("ERR_CANCELLED", "cancelled", null) } }
        return
      }
      if (index >= j.frames.size) return // the encoder thread finishes after the last frame
      if (inFlight >= MAX_IN_FLIGHT) { waiting = true; heldSince = SystemClock.elapsedRealtime(); return }
      val f = j.frames[index]
      currentFrame = index
      val moved = SystemClock.elapsedRealtime()
      val take = {
        val asked = SystemClock.elapsedRealtime()
        settleMs += asked - moved
        m.snapshot { picture -> snapshotMs += SystemClock.elapsedRealtime() - asked; taken(picture, f) }
      }
      // MapLibre draws a fresh frame for every snapshot, at the camera of the
      // moment, so the picture is asked for straight after the move. The spike
      // waited three screen refreshes first (44 ms a frame, then the snapshot
      // drew again); measured against a video made that way, the same
      // (T-329, 25 Nov 2026). The first frame waits while the tiles load.
      m.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(f[2], f[1])).zoom(f[3]).build()))
      if (index > 0) { take(); return }
      m.triggerRepaint()
      var left = FIRST_SETTLE_FRAMES
      Choreographer.getInstance().postFrameCallback(object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
          if (--left > 0) Choreographer.getInstance().postFrameCallback(this) else take()
        }
      })
    }

    private fun taken(picture: Bitmap, f: DoubleArray) {
      val frameIndex = index
      inFlight += 1
      composers[frameIndex % COMPOSERS].execute { compose(picture, f, frameIndex) }
      index += 1
      if (index % PROGRESS_EVERY == 0) onProgress(mapOf("done" to index, "total" to j.frames.size))
      main.post { next() }
    }

    /** A composer: roads and overlay onto the picture, then to the encoder thread. */
    private fun compose(picture: Bitmap, f: DoubleArray, frameIndex: Int) {
      if (cancelled) return
      val (roads, overlay) = painters[frameIndex % COMPOSERS]
      val frame = if (picture.isMutable) picture else picture.copy(Bitmap.Config.ARGB_8888, true)
      val canvas = Canvas(frame)
      val o = j.overlays.getJSONObject(frameIndex)
      val t1 = SystemClock.elapsedRealtime()
      roads.paint(canvas, f[0], f[1], f[2], f[3], o.optDouble("roadGlow", 0.0).toFloat())
      val t2 = SystemClock.elapsedRealtime()
      overlay.paint(canvas, o) { lon, lat, out -> roads.project(lon, lat, f[1], f[2], f[3], out) }
      roadsMs.addAndGet(t2 - t1); overlayMs.addAndGet(SystemClock.elapsedRealtime() - t2)
      encoding.execute { encodeInOrder(frameIndex, frame) }
    }

    /** The encoder thread: frames in the order they play, whichever composer finished first. */
    private fun encodeInOrder(frameIndex: Int, frame: Bitmap) {
      if (cancelled) return
      ready[frameIndex] = frame
      while (true) {
        val due = ready.remove(nextToEncode) ?: break
        val t0 = SystemClock.elapsedRealtime()
        encoder.add(due)
        encodeMs += SystemClock.elapsedRealtime() - t0
        nextToEncode += 1
        main.post {
          inFlight -= 1
          if (waiting) { waiting = false; heldMs += SystemClock.elapsedRealtime() - heldSince; next() }
        }
      }
      if (nextToEncode == j.frames.size) finish()
    }

    /** Encoder thread: close the file, put it in the gallery, answer. */
    private fun finish() {
      try {
        encoder.finish()
        Log.i(TAG, "export: ${j.frames.size} frames in ${SystemClock.elapsedRealtime() - startedAt} ms; settle $settleMs, snapshot $snapshotMs, roads $roadsMs, overlay $overlayMs, encode $encodeMs, main held $heldMs")
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
      composers.forEach { it.shutdown() }
      encoding.shutdown()
      exporting = null
      overlayView.visibility = VISIBLE
      this@BrumaVideoView.startedAt = SystemClock.elapsedRealtime()
      showFrame(0)
      if (playing) tick()
    }
  }

  private companion object {
    const val TAG = "BrumaVideo"
    /** The preview's road masks, pixels on their long side (`RoadPainter.cachePx`). */
    const val PREVIEW_CACHE_PX = 1600
    /** The video's size, pixels, and points to pixels: 360 x 640 points, as `videoJob.ts`. */
    const val FULL_W = 1080
    const val FULL_H = 1920
    const val PIXEL_RATIO = 3f
    /** The first frame waits this many screen refreshes, while the tiles load. */
    const val FIRST_SETTLE_FRAMES = 60
    /** Threads drawing roads and overlay onto the map's pictures. */
    const val COMPOSERS = 2
    /** Pictures between the map and the encoder at most: each is 8 MB. */
    const val MAX_IN_FLIGHT = 4
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

package com.proa.videospike

import android.app.Activity
import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
import android.view.Choreographer
import android.widget.FrameLayout
import android.widget.TextView
import org.json.JSONObject
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
 * T-329 spike: can the phone make the film as a video, and how fast? See README.md.
 *
 * Reads job.json and style.json from this app's external files folder. For every
 * frame of the film, on the main thread: move a MapLibre MapView's camera, wait a
 * few screen refreshes, take the map's picture. A worker thread then draws the
 * lit roads on it (`RoadPainter`) and hands it to the encoder (`FrameEncoder`),
 * while the map is already drawing the next frame. The MP4 is saved to
 * Movies/BrumaSpike; result.json records the time each step took, and frames 0,
 * 270 and 540 are kept as PNGs to look at.
 *
 * Traps met on the way, each of which looked like a result: MapSnapshotter
 * answered once and then never; MapLibre's idle and rendered-fully signals
 * never arrived after moveCamera; the browser's player showed one picture for a
 * correct MP4 (check frames with ffmpeg).
 */
class MainActivity : Activity() {
  private lateinit var log: TextView
  private lateinit var mapView: MapView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    MapLibre.getInstance(this)
    val dir = getExternalFilesDir(null)!!
    val job = Job.read(File(dir, "job.json"))

    val root = FrameLayout(this)
    val options = MapLibreMapOptions.createFromAttributes(this, null).pixelRatio(job.ratio).textureMode(true)
    mapView = MapView(this, options)
    root.addView(mapView, FrameLayout.LayoutParams(job.outW, job.outH))
    log = TextView(this).apply { textSize = 11f; setPadding(24, 24, 24, 24); setBackgroundColor(0xCCFFFFFF.toInt()) }
    root.addView(log, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    setContentView(root)
    mapView.onCreate(savedInstanceState)
    mapView.getMapAsync { map ->
      map.uiSettings.isLogoEnabled = false
      map.uiSettings.isAttributionEnabled = false
      map.uiSettings.isCompassEnabled = false
      map.setStyle(Style.Builder().fromJson(File(dir, "style.json").readText())) {
        try { Render(dir, job, map).start() } catch (e: Exception) { say("failed: $e") }
      }
    }
  }

  override fun onStart() { super.onStart(); mapView.onStart() }
  override fun onResume() { super.onResume(); mapView.onResume() }
  override fun onPause() { mapView.onPause(); super.onPause() }
  override fun onStop() { mapView.onStop(); super.onStop() }
  override fun onDestroy() { mapView.onDestroy(); super.onDestroy() }

  private fun say(line: String) {
    Log.i(TAG, line)
    runOnUiThread { log.append(line + "\n") }
  }

  /** What to render, from job.json. Frames are [atMs, lon, lat, zoom (MapLibre)]. */
  class Job(val width: Int, val height: Int, val ratio: Float, val fps: Int, val frames: List<DoubleArray>, val strokes: List<RoadPainter.Stroke>) {
    val outW = Math.round(width * ratio)
    val outH = Math.round(height * ratio)

    companion object {
      fun read(file: File): Job {
        val o = JSONObject(file.readText())
        val f = o.getJSONArray("frames")
        val frames = (0 until f.length()).map { i -> f.getJSONArray(i).let { a -> DoubleArray(4) { a.getDouble(it) } } }
        val s = o.getJSONArray("strokes")
        val strokes = (0 until s.length()).map { i ->
          val st = s.getJSONObject(i); val c = st.getJSONArray("c"); val t = st.getJSONArray("t")
          val lonLat = DoubleArray(c.length() * 2)
          for (k in 0 until c.length()) { val p = c.getJSONArray(k); lonLat[2 * k] = p.getDouble(0) / 1e5; lonLat[2 * k + 1] = p.getDouble(1) / 1e5 }
          RoadPainter.Stroke(lonLat, DoubleArray(t.length()) { t.getDouble(it) })
        }
        return Job(o.getInt("width"), o.getInt("height"), o.getDouble("pixelRatio").toFloat(), o.getInt("fps"), frames, strokes)
      }
    }
  }

  inner class Render(private val dir: File, private val job: Job, private val map: MapLibreMap) {
    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val tmp = File(cacheDir, "spike.mp4")
    private val painter = RoadPainter(job.strokes, job.outW, job.outH, job.ratio)
    private lateinit var encoder: FrameEncoder

    private var index = 0
    private var inFlight = 0              // pictures handed to the worker, not yet encoded (main thread only)
    private var waitingForWorker = false
    private var askedAt = 0L
    private var startedAt = 0L
    private val mapMs = ArrayList<Long>()  // main thread
    private val roadsMs = ArrayList<Long>() // worker
    private val encodeMs = ArrayList<Long>() // worker

    fun start() {
      say("job: ${job.frames.size} frames, ${job.outW}x${job.outH} at ${job.fps} fps, ${job.strokes.size} strokes")
      worker.execute { encoder = FrameEncoder(job.outW, job.outH, job.fps, tmp) }
      startedAt = SystemClock.elapsedRealtime()
      next()
    }

    /** Main thread: point the map at the next frame and, once it has settled, take its picture. */
    private fun next() {
      if (index >= job.frames.size) { worker.execute { finish() }; return }
      if (inFlight >= MAX_IN_FLIGHT) { waitingForWorker = true; return }
      val f = job.frames[index]
      askedAt = SystemClock.elapsedRealtime()
      map.moveCamera(CameraUpdateFactory.newCameraPosition(CameraPosition.Builder().target(LatLng(f[2], f[1])).zoom(f[3]).build()))
      map.triggerRepaint()
      // MapLibre's idle and rendered-fully signals never arrived here, so wait a few
      // screen refreshes; the first frame longer, while the tiles load.
      var left = if (index == 0) FIRST_SETTLE_FRAMES else SETTLE_FRAMES
      Choreographer.getInstance().postFrameCallback(object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
          if (--left > 0) Choreographer.getInstance().postFrameCallback(this)
          else map.snapshot { picture -> taken(picture, f) }
        }
      })
    }

    private fun taken(picture: Bitmap, f: DoubleArray) {
      mapMs.add(SystemClock.elapsedRealtime() - askedAt)
      val frameIndex = index
      if (frameIndex == 0) {
        val worst = painter.checkAgainst({ lon, lat -> map.projection.toScreenLocation(LatLng(lat, lon)).let { Pair(it.x, it.y) } }, f[1], f[2], f[3])
        say("own projection against MapLibre's: at most ${"%.2f".format(worst)} px apart")
      }
      inFlight += 1
      worker.execute { compose(picture, f, frameIndex) }
      index += 1
      main.post { next() }
    }

    /** Worker: roads onto the picture, then the encoder. */
    private fun compose(picture: Bitmap, f: DoubleArray, frameIndex: Int) {
      val t0 = SystemClock.elapsedRealtime()
      val canvasBitmap = if (picture.isMutable) picture else picture.copy(Bitmap.Config.ARGB_8888, true)
      val points = painter.paint(Canvas(canvasBitmap), f[0], f[1], f[2], f[3])
      val t1 = SystemClock.elapsedRealtime()
      encoder.add(canvasBitmap)
      val t2 = SystemClock.elapsedRealtime()
      roadsMs.add(t1 - t0); encodeMs.add(t2 - t1)
      if (frameIndex == 0 || frameIndex == 270 || frameIndex == 540) {
        File(dir, "frame-$frameIndex.png").outputStream().use { canvasBitmap.compress(Bitmap.CompressFormat.PNG, 90, it) }
        say("probe $frameIndex: at ${f[0].toInt()} ms, $points road points")
      }
      if (frameIndex % 60 == 0) say("frame $frameIndex: map ${mapMs.getOrNull(frameIndex)} ms, roads ${t1 - t0} ms, encode ${t2 - t1} ms")
      main.post {
        inFlight -= 1
        if (waitingForWorker) { waitingForWorker = false; next() }
      }
    }

    /** Worker: close the file, save it, write the record. */
    private fun finish() {
      encoder.finish()
      val totalMs = SystemClock.elapsedRealtime() - startedAt
      val uri = save()
      val result = JSONObject().apply {
        put("device", "${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}")
        put("method", "MapView settle then snapshot; roads by own Mercator; YUV on 4 threads; map and encoding overlapped")
        put("frames", index); put("framesWritten", encoder.written); put("totalMs", totalMs)
        put("videoSeconds", index.toDouble() / job.fps); put("chroma", encoder.chromaLayout)
        put("mapMs", stats(mapMs)); put("roadsMs", stats(roadsMs)); put("encodeMs", stats(encodeMs))
        put("bytes", tmp.length()); put("savedTo", uri)
      }
      File(dir, "result.json").writeText(result.toString(2))
      worker.shutdown()
      say("DONE $result")
    }

    private fun stats(values: List<Long>): JSONObject {
      val s = values.sorted()
      val at = { p: Double -> if (s.isEmpty()) -1L else s[minOf(s.size - 1, (s.size * p).toInt())] }
      return JSONObject().put("p50", at(.5)).put("p90", at(.9)).put("max", at(1.0))
    }

    private fun save(): String {
      if (Build.VERSION.SDK_INT < 29) return tmp.absolutePath
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, "Bruma spike ${System.currentTimeMillis()}.mp4")
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/BrumaSpike")
        put(MediaStore.Video.Media.IS_PENDING, 1)
      }
      val uri = contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values) ?: return "insert failed"
      contentResolver.openOutputStream(uri)!!.use { out -> tmp.inputStream().use { it.copyTo(out) } }
      values.clear(); values.put(MediaStore.Video.Media.IS_PENDING, 0)
      contentResolver.update(uri, values, null, null)
      return uri.toString()
    }
  }

  private companion object {
    const val TAG = "VideoSpike"
    /** Screen refreshes to wait after moving the camera, before the picture. */
    const val SETTLE_FRAMES = 3
    /** The first frame waits for the map's tiles to load. */
    const val FIRST_SETTLE_FRAMES = 60
    /** Pictures waiting for the worker at most: each is 8 MB. */
    const val MAX_IN_FLIGHT = 2
  }
}

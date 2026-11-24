package com.proa.videospike

import android.app.Activity
import android.content.ContentValues
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.MediaStore
import android.util.Log
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

/**
 * T-329 spike. Reads job.json and style.json from this app's external files
 * folder (pushed by hand, see tools/video-spike/README.md), and for every frame
 * of the film: moves a MapLibre MapView's camera, waits a few screen
 * refreshes, takes its picture, draws the lit roads on top with a
 * Canvas, and encodes H.264 into an MP4, saved to Movies/BrumaSpike.
 * result.json records the time each step took; three frames are kept as PNGs.
 *
 * ⚠ A first version used MapSnapshotter: it answered the first request and
 * then never again (or, once, returned the same picture 546 times). A MapView
 * is also what the app's preview screen would show anyway.
 */
/** Screen refreshes to wait after moving the camera before the picture. */
private const val SETTLE_FRAMES = 3
/** The first frame waits for the map's tiles to load. */
private const val FIRST_SETTLE_FRAMES = 60

class MainActivity : Activity() {
  private val tag = "VideoSpike"
  private lateinit var log: TextView
  private lateinit var mapView: MapView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    MapLibre.getInstance(this)
    val dir = getExternalFilesDir(null)!!
    val job = JSONObject(File(dir, "job.json").readText())
    val ratio = job.getDouble("pixelRatio").toFloat()
    val outW = Math.round(job.getInt("width") * ratio)
    val outH = Math.round(job.getInt("height") * ratio)

    val root = FrameLayout(this)
    val options = MapLibreMapOptions.createFromAttributes(this, null).pixelRatio(ratio).textureMode(true)
    mapView = MapView(this, options)
    root.addView(mapView, FrameLayout.LayoutParams(outW, outH))
    log = TextView(this).apply { textSize = 11f; setPadding(24, 24, 24, 24); setBackgroundColor(0xCCFFFFFF.toInt()) }
    root.addView(log, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))
    setContentView(root)
    mapView.onCreate(savedInstanceState)
    mapView.getMapAsync { map ->
      map.uiSettings.isLogoEnabled = false
      map.uiSettings.isAttributionEnabled = false
      map.uiSettings.isCompassEnabled = false
      map.setStyle(Style.Builder().fromJson(File(dir, "style.json").readText())) {
        try { Spike(dir, job, map, outW, outH, ratio).start() } catch (e: Exception) { say("failed: $e") }
      }
    }
  }

  override fun onStart() { super.onStart(); mapView.onStart() }
  override fun onResume() { super.onResume(); mapView.onResume() }
  override fun onPause() { mapView.onPause(); super.onPause() }
  override fun onStop() { mapView.onStop(); super.onStop() }
  override fun onDestroy() { mapView.onDestroy(); super.onDestroy() }

  private fun say(line: String) {
    Log.i(tag, line)
    runOnUiThread { log.append(line + "\n") }
  }

  inner class Spike(
    private val dir: File, job: JSONObject, private val map: MapLibreMap,
    private val outW: Int, private val outH: Int, private val ratio: Float,
  ) {
    private val fps = job.getInt("fps")
    private val frames: List<DoubleArray>
    private val strokes: List<Pair<DoubleArray, DoubleArray>> // (lon,lat interleaved, times)
    private val handler = Handler(Looper.getMainLooper())

    init {
      val f = job.getJSONArray("frames")
      frames = (0 until f.length()).map { i -> f.getJSONArray(i).let { a -> DoubleArray(4) { a.getDouble(it) } } }
      val s = job.getJSONArray("strokes")
      strokes = (0 until s.length()).map { i ->
        val o = s.getJSONObject(i); val c = o.getJSONArray("c"); val t = o.getJSONArray("t")
        val xy = DoubleArray(c.length() * 2)
        for (k in 0 until c.length()) { val p = c.getJSONArray(k); xy[2 * k] = p.getDouble(0) / 1e5; xy[2 * k + 1] = p.getDouble(1) / 1e5 }
        Pair(xy, DoubleArray(t.length()) { t.getDouble(it) })
      }
    }

    private lateinit var codec: MediaCodec
    private lateinit var frame: Bitmap      // the composed frame, map and roads, reused
    private lateinit var argb: IntArray
    private var queued = 0                   // frames handed to the encoder
    private lateinit var muxer: MediaMuxer
    private var track = -1
    private var muxing = false
    private var written = 0
    private val tmp = File(cacheDir, "spike.mp4")
    private var index = 0
    private val renderMs = ArrayList<Long>()
    private val drawMs = ArrayList<Long>()
    private var startedAt = 0L
    private var askedAt = 0L

    private val casing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE; color = Color.WHITE; alpha = 235; strokeWidth = 8f * ratio
      strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val core = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE; color = Color.rgb(0xB3, 0x3A, 0x0A); strokeWidth = 4f * ratio
      strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }

    fun start() {
      say("job: ${frames.size} frames, ${outW}x$outH at $fps fps, ${strokes.size} strokes")
      val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, outW, outH).apply {
        // Frames are handed over as YUV with their own timestamps. Drawing into the
        // encoder's input Surface instead gave an MP4 that repeated one picture on the P30.
        setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
        setInteger(MediaFormat.KEY_BIT_RATE, 10_000_000)
        setInteger(MediaFormat.KEY_FRAME_RATE, fps)
        setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
      }
      codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
      codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      codec.start()
      frame = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888)
      argb = IntArray(outW * outH)
      muxer = MediaMuxer(tmp.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      startedAt = SystemClock.elapsedRealtime()
      handler.post { next() }
    }

    private fun next() {
      if (index >= frames.size) { finish(); return }
      val f = frames[index]
      askedAt = SystemClock.elapsedRealtime()
      map.moveCamera(CameraUpdateFactory.newCameraPosition(
        CameraPosition.Builder().target(LatLng(f[2], f[1])).zoom(f[3]).build()))
      map.triggerRepaint()
      // Wait SETTLE_FRAMES screen refreshes, then take the picture. MapLibre's own
      // signals (idle, frame rendered fully) never arrived after moveCamera in this
      // setup, so every frame waited a 3 s fallback. Frames 270 and 540 are kept as
      // PNGs to check that no tile is missing.
      // The first frame waits longer: the map's tiles are still loading.
      var left = if (index == 0) FIRST_SETTLE_FRAMES else SETTLE_FRAMES
      val choreographer = android.view.Choreographer.getInstance()
      val tick = object : android.view.Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
          left -= 1
          if (left > 0) choreographer.postFrameCallback(this) else { trace("settled"); take(f) }
        }
      }
      choreographer.postFrameCallback(tick)
    }

    private fun take(f: DoubleArray) {
      map.snapshot { bitmap -> trace("snapshot ${bitmap.width}x${bitmap.height}"); compose(bitmap, f[0]) }
    }

    private fun compose(bitmap: Bitmap, atMs: Double) {
      val t0 = SystemClock.elapsedRealtime()
      renderMs.add(t0 - askedAt)
      val path = Path()
      var points = 0
      val projection = map.projection
      for ((xy, t) in strokes) {
        if (t[0] > atMs) continue
        var k = 0
        while (k < t.size) {
          var lon = xy[2 * k]; var lat = xy[2 * k + 1]
          val beyond = t[k] > atMs
          if (beyond) {
            if (k == 0) break
            val u = (atMs - t[k - 1]) / Math.max(1.0, t[k] - t[k - 1])
            lon = xy[2 * k - 2] + (lon - xy[2 * k - 2]) * u
            lat = xy[2 * k - 1] + (lat - xy[2 * k - 1]) * u
          }
          val p = projection.toScreenLocation(LatLng(lat, lon))
          if (k == 0) path.moveTo(p.x, p.y) else path.lineTo(p.x, p.y)
          points += 1
          if (beyond) break
          k += 1
        }
      }
      val canvas = Canvas(frame)
      canvas.drawBitmap(bitmap, null, android.graphics.Rect(0, 0, outW, outH), null)
      canvas.drawPath(path, casing)
      canvas.drawPath(path, core)
      encode(frame)
      if (index == 0 || index == 270 || index == 540) {
        // Exactly the picture handed to the encoder.
        File(dir, "frame-$index.png").outputStream().use { frame.compress(Bitmap.CompressFormat.PNG, 90, it) }
        say("probe $index: at ${atMs.toInt()} ms, bitmap ${bitmap.width}x${bitmap.height}, zoom now ${"%.2f".format(map.cameraPosition.zoom)}, $points road points")
      }
      drain(false)
      drawMs.add(SystemClock.elapsedRealtime() - t0)
      if (index % 10 == 0) say("frame $index: map ${renderMs.last()} ms, draw+encode ${drawMs.last()} ms")
      index += 1
      handler.post { next() }
    }

    /** Step markers for the first frames, on screen: where a stall happens (logcat drops our info lines on EMUI). */
    private fun trace(step: String) {
      if (index < 3) say("  $index $step")
    }

    /** Hand one frame to the encoder as YUV 4:2:0, stamped `queued / fps`. */
    private fun encode(picture: Bitmap) {
      picture.getPixels(argb, 0, outW, 0, 0, outW, outH)
      var input: Int
      while (true) {
        input = codec.dequeueInputBuffer(10_000)
        if (input >= 0) break
        drain(false)
      }
      val image = codec.getInputImage(input)!!
      val y = image.planes[0]; val u = image.planes[1]; val v = image.planes[2]
      val yBuf = y.buffer; val uBuf = u.buffer; val vBuf = v.buffer
      for (row in 0 until outH) {
        var at = row * y.rowStride
        val base = row * outW
        for (col in 0 until outW) {
          val c = argb[base + col]
          val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
          yBuf.put(at, (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).toByte())
          at += y.pixelStride
        }
      }
      for (row in 0 until outH / 2) {
        for (col in 0 until outW / 2) {
          val c = argb[(2 * row) * outW + 2 * col]
          val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
          uBuf.put(row * u.rowStride + col * u.pixelStride, (((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128).toByte())
          vBuf.put(row * v.rowStride + col * v.pixelStride, (((112 * r - 94 * g - 18 * b + 128) shr 8) + 128).toByte())
        }
      }
      codec.queueInputBuffer(input, 0, outW * outH * 3 / 2, queued * 1_000_000L / fps, 0)
      queued += 1
    }

    private fun drain(end: Boolean) {
      val info = MediaCodec.BufferInfo()
      while (true) {
        val out = codec.dequeueOutputBuffer(info, if (end) 10_000 else 0)
        when {
          out == MediaCodec.INFO_TRY_AGAIN_LATER -> if (!end) return
          out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> { track = muxer.addTrack(codec.outputFormat); muxer.start(); muxing = true }
          out >= 0 -> {
            val buffer = codec.getOutputBuffer(out)!!
            if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0) info.size = 0
            if (info.size > 0 && muxing) {
              buffer.position(info.offset); buffer.limit(info.offset + info.size)
              muxer.writeSampleData(track, buffer, info)
              written += 1
            }
            codec.releaseOutputBuffer(out, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
          }
        }
      }
    }

    private fun finish() {
      var input: Int
      while (true) { input = codec.dequeueInputBuffer(10_000); if (input >= 0) break; drain(false) }
      codec.queueInputBuffer(input, 0, 0, queued * 1_000_000L / fps, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      drain(true)
      codec.stop(); codec.release()
      if (muxing) muxer.stop()
      muxer.release()
      val totalMs = SystemClock.elapsedRealtime() - startedAt
      val uri = save()
      val pct = { l: List<Long>, p: Double -> val s = l.sorted(); if (s.isEmpty()) -1L else s[Math.min(s.size - 1, (s.size * p).toInt())] }
      val result = JSONObject().apply {
        put("device", "${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE}")
        put("method", "MapView, settle frames, snapshot, YUV to the encoder")
        put("frames", index); put("framesWritten", written); put("totalMs", totalMs)
        put("videoSeconds", index.toDouble() / fps); put("settleFrames", SETTLE_FRAMES)
        put("mapMs", JSONObject().put("p50", pct(renderMs, .5)).put("p90", pct(renderMs, .9)).put("max", pct(renderMs, 1.0)))
        put("drawEncodeMs", JSONObject().put("p50", pct(drawMs, .5)).put("p90", pct(drawMs, .9)).put("max", pct(drawMs, 1.0)))
        put("bytes", tmp.length()); put("savedTo", uri)
      }
      File(dir, "result.json").writeText(result.toString(2))
      say("DONE $result")
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
}

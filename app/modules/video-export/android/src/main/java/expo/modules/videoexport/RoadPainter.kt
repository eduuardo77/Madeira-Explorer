package expo.modules.videoexport

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.tan

/**
 * Draws the pen's strokes as they stand at a moment of the film, onto a frame
 * the map has already drawn.
 *
 * Positions are Web Mercator worked out here, not asked of MapLibre point by
 * point (thousands of `toScreenLocation` calls a frame were most of the
 * drawing time, and they run only on the main thread). MapLibre's world is 512
 * points wide at zoom 0; `ratio` turns points into pixels.
 *
 * Fast enough for the preview (T-329, 25 Nov 2026): every point is projected
 * to Mercator once, here, and the camera becomes one matrix a frame; road
 * older than `FRESH_MS` goes into a path that only ever grows, so a frame
 * appends a few points and redraws the last second of road rather than
 * rebuilding all 20,000 points. Drawing the roads had grown from 2 to 11 ms a
 * frame by the end of the lead's trip, and the preview from 58 to 12 fps.
 * Going back in time (the preview looping) starts the path again.
 */
class RoadPainter(
  private val strokes: List<Stroke>,
  private val width: Int,
  private val height: Int,
  private val ratio: Float,
  /**
   * The preview's way (0 for the saved video): road older than `FRESH_MS`
   * is painted once into masks this many pixels on their long side, and each
   * frame draws the masks scaled, three bitmaps rather than three strokes of
   * every road. Stroking 20,000 points a frame held the preview to 19 fps by
   * the end of the lead's trip, the cost growing with the road. Lines then
   * scale with the camera's zoom, a little wider when it closes in; the saved
   * video strokes every frame exactly.
   */
  private val cachePx: Int = 0,
) {
  /** One stroke: lon, lat interleaved, and when the pen reaches each point, ms. */
  class Stroke(val lonLat: DoubleArray, val times: DoubleArray)

  // Mercator, relative to the first point and scaled up so floats keep their precision.
  private val originX = strokes.firstOrNull()?.let { mercX(it.lonLat[0]) } ?: 0.0
  private val originY = strokes.firstOrNull()?.let { mercY(it.lonLat[1]) } ?: 0.0
  private val local: List<FloatArray> = strokes.map { stroke ->
    FloatArray(stroke.lonLat.size).also { out ->
      for (k in 0 until stroke.times.size) {
        out[2 * k] = ((mercX(stroke.lonLat[2 * k]) - originX) * LOCAL).toFloat()
        out[2 * k + 1] = ((mercY(stroke.lonLat[2 * k + 1]) - originY) * LOCAL).toFloat()
      }
    }
  }

  /**
   * Four points round the roads (lon, lat), for a tilted camera: the map is
   * asked where they land on screen and the four answers fix the perspective
   * from the roads' plane to the frame (`paint`'s `screen`). A tilted map of a
   * flat ground is exactly such a perspective, so four points are enough.
   */
  val anchors: List<DoubleArray>
  private val anchorsLocal = FloatArray(8)

  init {
    var x0 = Float.MAX_VALUE; var y0 = Float.MAX_VALUE; var x1 = -Float.MAX_VALUE; var y1 = -Float.MAX_VALUE
    for (xy in local) for (i in xy.indices step 2) {
      x0 = minOf(x0, xy[i]); x1 = maxOf(x1, xy[i]); y0 = minOf(y0, xy[i + 1]); y1 = maxOf(y1, xy[i + 1])
    }
    if (x0 > x1) { x0 = 0f; x1 = 0f; y0 = 0f; y1 = 0f }
    val pad = maxOf((x1 - x0), (y1 - y0), 200f) * 0.25f
    val corners = arrayOf(floatArrayOf(x0 - pad, y0 - pad), floatArrayOf(x1 + pad, y0 - pad), floatArrayOf(x1 + pad, y1 + pad), floatArrayOf(x0 - pad, y1 + pad))
    corners.forEachIndexed { i, c -> anchorsLocal[2 * i] = c[0]; anchorsLocal[2 * i + 1] = c[1] }
    anchors = corners.map { c -> doubleArrayOf(lonOf(c[0] / LOCAL + originX), latOf(c[1] / LOCAL + originY)) }
  }

  /** Road the pen laid more than `FRESH_MS` ago: appended to, never rebuilt while time goes forward. */
  private val settled = Path()
  /** Points of each stroke already in `settled`. */
  private val settledCount = IntArray(strokes.size)
  private var settledTo = Double.NEGATIVE_INFINITY
  private var lastAppended = -1

  private val cache: MaskCache? = if (cachePx > 0 && strokes.isNotEmpty()) MaskCache() else null

  private val recent = Path()
  private val bands = Array(BANDS) { Path() }
  private val matrix = Matrix()

  private fun stroke(colour: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE; color = colour; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
  }
  private val casing = stroke(Color.WHITE).apply { alpha = 210 }
  private val core = stroke(SETTLED)
  private val glow = stroke(LIT)
  private val fresh = stroke(FRESH)
  private val freshGlow = stroke(FRESH)

  /** Screen position of (lon, lat), pixels, under the camera of the last `paint`. */
  fun projectFrame(lon: Double, lat: Double, out: FloatArray) {
    out[0] = ((mercX(lon) - originX) * LOCAL).toFloat()
    out[1] = ((mercY(lat) - originY) * LOCAL).toFloat()
    matrix.mapPoints(out)
  }

  private val probe = FloatArray(4)

  /** Screen position of (lon, lat), pixels, for a camera at (cLon, cLat, zoom). */
  fun project(lon: Double, lat: Double, cLon: Double, cLat: Double, zoom: Double, out: FloatArray) {
    val world = 512.0 * 2.0.pow(zoom) * ratio
    out[0] = ((mercX(lon) - mercX(cLon)) * world + width / 2.0).toFloat()
    out[1] = ((mercY(lat) - mercY(cLat)) * world + height / 2.0).toFloat()
  }

  /**
   * Draws the strokes as the pen has them at `atMs`; returns the points drawn
   * this frame (the settled path's appends and the recent road).
   *
   * The road the pen has just laid is bright and glows, and settles to the
   * deep red over `FRESH_MS`, so the eye finds today's road among the rest.
   * `roadGlow` (the overlay's, 0 to 1) lights every road at the close. Lines
   * are thinner when the camera is wide: at the whole island the old width
   * ran Funchal's streets into one red patch.
   */
  fun paint(canvas: Canvas, atMs: Double, cLon: Double, cLat: Double, zoom: Double, roadGlow: Float = 0f, screen: FloatArray? = null): Int {
    val cutoff = atMs - FRESH_MS
    var points = settle(cutoff)
    points += freshRoad(atMs, cutoff)

    // The camera as one matrix: local units to pixels; a perspective one when
    // the map is tilted (`screen`: where the `anchors` landed, pixels).
    val world = 512.0 * 2.0.pow(zoom) * ratio
    var scale = (world / LOCAL).toFloat()
    if (screen != null) {
      matrix.setPolyToPoly(anchorsLocal, 0, screen, 0, 4)
      // Line widths by the scale at the middle of the roads.
      probe[0] = (anchorsLocal[0] + anchorsLocal[4]) / 2; probe[1] = (anchorsLocal[1] + anchorsLocal[5]) / 2
      probe[2] = probe[0] + 1f; probe[3] = probe[1]
      matrix.mapPoints(probe)
      scale = kotlin.math.hypot(probe[2] - probe[0], probe[3] - probe[1])
    } else {
      matrix.setScale(scale, scale)
      matrix.postTranslate(
        ((originX - mercX(cLon)) * world + width / 2.0).toFloat(),
        ((originY - mercY(cLat)) * world + height / 2.0).toFloat(),
      )
    }
    val w = cache?.widthLocal ?: ((BASE_WIDTH + (zoom - WIDE_ZOOM) * WIDTH_PER_LEVEL).coerceIn(MIN_WIDTH, MAX_WIDTH).toFloat() * ratio / scale)
    val g = roadGlow.coerceIn(0f, 1f)
    if (cache != null) {
      cache.draw(canvas, matrix, w, g)
      return points
    }

    canvas.save()
    canvas.concat(matrix)
    if (g > 0f) {
      glow.strokeWidth = w * 3.4f; glow.alpha = (70 * g).toInt()
      canvas.drawPath(settled, glow)
      canvas.drawPath(recent, glow)
    }
    casing.strokeWidth = w + 2.6f * ratio / scale
    canvas.drawPath(settled, casing)
    canvas.drawPath(recent, casing)
    core.strokeWidth = w
    core.color = blend(SETTLED, LIT, g)
    canvas.drawPath(settled, core)
    canvas.drawPath(recent, core)
    // Oldest band first, so the newest sits on top.
    for (b in BANDS - 1 downTo 0) {
      val strength = 1f - b.toFloat() / BANDS
      freshGlow.strokeWidth = w * 3f; freshGlow.alpha = (60 * strength).toInt()
      canvas.drawPath(bands[b], freshGlow)
    }
    for (b in BANDS - 1 downTo 0) {
      val strength = 1f - b.toFloat() / BANDS
      fresh.strokeWidth = w * (1f + 0.15f * strength); fresh.alpha = (255 * strength).toInt()
      canvas.drawPath(bands[b], fresh)
    }
    canvas.restore()
    return points
  }

  /** Appends to `settled` every point the pen reached by `cutoff`; starts again when time went back. */
  private fun settle(cutoff: Double): Int {
    if (cutoff < settledTo) {
      settled.rewind()
      settledCount.fill(0)
      lastAppended = -1
      cache?.clear()
    }
    // With masks, only what is new this frame is drawn into them.
    val into = if (cache != null) cache.appended.also { it.rewind() } else settled
    settledTo = cutoff
    var appended = 0
    for (s in strokes.indices) {
      val t = strokes[s].times
      var k = settledCount[s]
      if (k >= t.size || t[k] > cutoff) continue
      val xy = local[s]
      // A stroke picked up again after another: start from where it stopped.
      if (k == 0) into.moveTo(xy[0], xy[1]) else if (lastAppended != s || cache != null) into.moveTo(xy[2 * k - 2], xy[2 * k - 1])
      if (k == 0) k = 1
      while (k < t.size && t[k] <= cutoff) {
        into.lineTo(xy[2 * k], xy[2 * k + 1])
        k += 1
        appended += 1
      }
      settledCount[s] = k
      lastAppended = s
    }
    if (cache != null && appended > 0) cache.add(cache.appended)
    return appended
  }

  /** The road laid since `cutoff`, as one path and in bands by age; the last segment stops at the pen. */
  private fun freshRoad(atMs: Double, cutoff: Double): Int {
    recent.rewind()
    for (b in bands) b.rewind()
    var points = 0
    for (s in strokes.indices) {
      val t = strokes[s].times
      if (t[0] > atMs || t[t.size - 1] <= cutoff) continue
      val xy = local[s]
      // The first fresh segment starts at the last settled point (or the stroke's start).
      var k = maxOf(1, settledCount[s])
      var x = xy[2 * k - 2]
      var y = xy[2 * k - 1]
      recent.moveTo(x, y)
      var lastBand = -1
      while (k < t.size) {
        val beyond = t[k] > atMs
        var nx = xy[2 * k]
        var ny = xy[2 * k + 1]
        if (beyond) {
          // The pen is between point k-1 and k: stop where it is.
          val u = ((atMs - t[k - 1]) / maxOf(1.0, t[k] - t[k - 1])).toFloat()
          nx = x + (nx - x) * u
          ny = y + (ny - y) * u
        }
        recent.lineTo(nx, ny)
        val age = atMs - minOf(t[k], atMs)
        val band = if (age < FRESH_MS) (age / FRESH_MS * BANDS).toInt().coerceIn(0, BANDS - 1) else -1
        if (band >= 0) {
          if (band != lastBand) bands[band].moveTo(x, y)
          bands[band].lineTo(nx, ny)
        }
        lastBand = band
        x = nx; y = ny
        points += 1
        k += 1
        if (beyond) break
      }
    }
    return points
  }

  /** The settled road as three masks (glow, casing, core), in local units scaled by `k`. */
  private inner class MaskCache {
    private val refScale = (512.0 * 2.0.pow(WIDE_ZOOM + 0.25) * ratio / LOCAL).toFloat()
    /** The casing's extra width, local units. */
    private val casingExtra = 2.6f * ratio / refScale
    private val margin: Float
    private val minX: Float
    private val minY: Float
    private val k: Float
    /** Line width in local units: the video's width at a camera a quarter level in from the whole island. */
    val widthLocal: Float
    private val glowMask: Bitmap
    private val casingMask: Bitmap
    private val coreMask: Bitmap
    private val toMask = Matrix()
    private val toScreen = Matrix()
    val appended = Path()
    private val ink = stroke(Color.BLACK)
    private val tint = Paint(Paint.FILTER_BITMAP_FLAG)

    init {
      var x0 = Float.MAX_VALUE; var y0 = Float.MAX_VALUE; var x1 = -Float.MAX_VALUE; var y1 = -Float.MAX_VALUE
      for (xy in local) for (i in xy.indices step 2) {
        x0 = minOf(x0, xy[i]); x1 = maxOf(x1, xy[i]); y0 = minOf(y0, xy[i + 1]); y1 = maxOf(y1, xy[i + 1])
      }
      widthLocal = (BASE_WIDTH + 0.25 * WIDTH_PER_LEVEL).toFloat() * ratio / refScale
      margin = widthLocal * 2.5f
      minX = x0 - margin; minY = y0 - margin
      val spanX = (x1 - x0) + 2 * margin
      val spanY = (y1 - y0) + 2 * margin
      k = cachePx / maxOf(spanX, spanY, 1f)
      val bw = maxOf(1, (spanX * k).toInt() + 1)
      val bh = maxOf(1, (spanY * k).toInt() + 1)
      glowMask = Bitmap.createBitmap(bw, bh, Bitmap.Config.ALPHA_8)
      casingMask = Bitmap.createBitmap(bw, bh, Bitmap.Config.ALPHA_8)
      coreMask = Bitmap.createBitmap(bw, bh, Bitmap.Config.ALPHA_8)
      toMask.setScale(k, k)
      toMask.preTranslate(-minX, -minY)
    }

    fun clear() {
      glowMask.eraseColor(Color.TRANSPARENT); casingMask.eraseColor(Color.TRANSPARENT); coreMask.eraseColor(Color.TRANSPARENT)
    }

    fun add(path: Path) {
      for ((mask, width) in listOf(glowMask to widthLocal * 3.4f, casingMask to widthLocal + casingExtra, coreMask to widthLocal)) {
        val c = Canvas(mask)
        c.concat(toMask)
        ink.strokeWidth = width
        c.drawPath(path, ink)
      }
    }

    /** The masks under the camera, then the recent road over them, in the vector order. */
    fun draw(canvas: Canvas, camera: Matrix, w: Float, g: Float) {
      toScreen.set(camera)
      toScreen.preTranslate(minX, minY)
      toScreen.preScale(1f / k, 1f / k)
      if (g > 0f) { tint.color = LIT; tint.alpha = (70 * g).toInt(); canvas.drawBitmap(glowMask, toScreen, tint) }
      tint.color = Color.WHITE; tint.alpha = 210
      canvas.drawBitmap(casingMask, toScreen, tint)
      canvas.save()
      canvas.concat(camera)
      casing.strokeWidth = w + casingExtra
      canvas.drawPath(recent, casing)
      canvas.restore()
      tint.color = blend(SETTLED, LIT, g); tint.alpha = 255
      canvas.drawBitmap(coreMask, toScreen, tint)
      canvas.save()
      canvas.concat(camera)
      core.strokeWidth = w; core.color = blend(SETTLED, LIT, g)
      canvas.drawPath(recent, core)
      for (b in BANDS - 1 downTo 0) {
        val strength = 1f - b.toFloat() / BANDS
        freshGlow.strokeWidth = w * 3f; freshGlow.alpha = (60 * strength).toInt()
        canvas.drawPath(bands[b], freshGlow)
      }
      for (b in BANDS - 1 downTo 0) {
        val strength = 1f - b.toFloat() / BANDS
        fresh.strokeWidth = w * (1f + 0.15f * strength); fresh.alpha = (255 * strength).toInt()
        canvas.drawPath(bands[b], fresh)
      }
      canvas.restore()
    }
  }

  private fun blend(a: Int, b: Int, u: Float): Int = Color.rgb(
    (Color.red(a) + (Color.red(b) - Color.red(a)) * u).toInt(),
    (Color.green(a) + (Color.green(b) - Color.green(a)) * u).toInt(),
    (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * u).toInt(),
  )

  private fun lonOf(x: Double) = x * 360.0 - 180.0
  private fun latOf(y: Double) = Math.toDegrees(kotlin.math.atan(kotlin.math.sinh(PI * (1 - 2 * y))))
  private fun mercX(lon: Double) = (lon + 180.0) / 360.0
  private fun mercY(lat: Double) = (1.0 - ln(tan(PI / 4 + lat * PI / 360.0)) / PI) / 2.0

  companion object {
    /** Mercator units to local ones: the island spans about 1,600. */
    private const val LOCAL = 1e6
    /** The road once settled, and lit at the close. */
    private val SETTLED = Color.rgb(0xB3, 0x3A, 0x0A)
    private val LIT = Color.rgb(0xE8, 0x55, 0x14)
    /** The road the pen has just laid. */
    private val FRESH = Color.rgb(0xFF, 0x7A, 0x33)
    /** How long new road stays bright, ms, in `BANDS` steps of fading. */
    private const val FRESH_MS = 900.0
    private const val BANDS = 4
    /** Line width, points: `BASE_WIDTH` at the whole island (MapLibre zoom `WIDE_ZOOM`), wider closer in. */
    private const val BASE_WIDTH = 2.8
    private const val WIDE_ZOOM = 8.7
    private const val WIDTH_PER_LEVEL = 0.7
    private const val MIN_WIDTH = 2.5
    private const val MAX_WIDTH = 4.0
  }
}

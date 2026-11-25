package expo.modules.videoexport

import android.graphics.Canvas
import android.graphics.Color
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
 * Positions are worked out with Web Mercator directly from the frame's camera,
 * not by asking MapLibre point by point: thousands of `toScreenLocation` calls
 * a frame were most of the drawing time, and they can only run on the main
 * thread. `checkAgainst` compares the two once, so a wrong formula shows.
 *
 * MapLibre's world is 512 points wide at zoom 0; `ratio` turns points into pixels.
 */
class RoadPainter(
  private val strokes: List<Stroke>,
  private val width: Int,
  private val height: Int,
  private val ratio: Float,
) {
  /** One stroke: lon, lat interleaved, and when the pen reaches each point, ms. */
  class Stroke(val lonLat: DoubleArray, val times: DoubleArray)

  private fun stroke(colour: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE; color = colour; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
  }
  private val casing = stroke(Color.WHITE).apply { alpha = 210 }
  private val core = stroke(SETTLED)
  private val glow = stroke(LIT)
  private val fresh = stroke(FRESH)
  private val freshGlow = stroke(FRESH)

  /** Screen position of (lon, lat), pixels, for a camera at (cLon, cLat, zoom). */
  fun project(lon: Double, lat: Double, cLon: Double, cLat: Double, zoom: Double, out: FloatArray) {
    val world = 512.0 * 2.0.pow(zoom) * ratio
    out[0] = ((mercX(lon) - mercX(cLon)) * world + width / 2.0).toFloat()
    out[1] = ((mercY(lat) - mercY(cLat)) * world + height / 2.0).toFloat()
  }

  /**
   * Draws the strokes as the pen has them at `atMs`; returns the points drawn.
   *
   * The road the pen has just laid is bright and glows, and settles to the
   * deep red over `FRESH_MS`, so the eye finds today's road among the rest.
   * `roadGlow` (the overlay's, 0 to 1) lights every road at the close. Lines
   * are thinner when the camera is wide: at the whole island the old width
   * ran Funchal's streets into one red patch.
   */
  fun paint(canvas: Canvas, atMs: Double, cLon: Double, cLat: Double, zoom: Double, roadGlow: Float = 0f): Int {
    val all = Path()
    val bands = Array(BANDS) { Path() }
    val p = FloatArray(2)
    val prev = FloatArray(2)
    var points = 0
    for (stroke in strokes) {
      val t = stroke.times
      val xy = stroke.lonLat
      if (t[0] > atMs) continue
      var lastBand = -1
      for (k in t.indices) {
        var lon = xy[2 * k]
        var lat = xy[2 * k + 1]
        val beyond = t[k] > atMs
        if (beyond) {
          // The pen is between point k-1 and k: stop where it is.
          val u = (atMs - t[k - 1]) / maxOf(1.0, t[k] - t[k - 1])
          lon = xy[2 * k - 2] + (lon - xy[2 * k - 2]) * u
          lat = xy[2 * k - 1] + (lat - xy[2 * k - 1]) * u
        }
        project(lon, lat, cLon, cLat, zoom, p)
        if (k == 0) {
          all.moveTo(p[0], p[1])
        } else {
          all.lineTo(p[0], p[1])
          // The segment's age: how long ago the pen reached its far end.
          val age = atMs - minOf(t[k], atMs)
          val band = if (age < FRESH_MS) (age / FRESH_MS * BANDS).toInt().coerceIn(0, BANDS - 1) else -1
          if (band >= 0) {
            if (band != lastBand) bands[band].moveTo(prev[0], prev[1])
            bands[band].lineTo(p[0], p[1])
          }
          lastBand = band
        }
        prev[0] = p[0]; prev[1] = p[1]
        points += 1
        if (beyond) break
      }
    }

    val w = (BASE_WIDTH + (zoom - WIDE_ZOOM) * WIDTH_PER_LEVEL).coerceIn(MIN_WIDTH, MAX_WIDTH).toFloat() * ratio
    val g = roadGlow.coerceIn(0f, 1f)
    if (g > 0f) {
      glow.strokeWidth = w * 3.4f; glow.alpha = (70 * g).toInt()
      canvas.drawPath(all, glow)
    }
    casing.strokeWidth = w + 2.6f * ratio
    canvas.drawPath(all, casing)
    core.strokeWidth = w
    core.color = blend(SETTLED, LIT, g)
    canvas.drawPath(all, core)
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
    return points
  }

  /** The largest distance, pixels, between this projection and `reference` over some stroke points. */
  fun checkAgainst(reference: (lon: Double, lat: Double) -> Pair<Float, Float>, cLon: Double, cLat: Double, zoom: Double): Float {
    val p = FloatArray(2)
    var worst = 0f
    for (stroke in strokes.take(20)) {
      for (k in stroke.times.indices step 7) {
        val lon = stroke.lonLat[2 * k]; val lat = stroke.lonLat[2 * k + 1]
        project(lon, lat, cLon, cLat, zoom, p)
        val (rx, ry) = reference(lon, lat)
        worst = maxOf(worst, kotlin.math.hypot((p[0] - rx).toDouble(), (p[1] - ry).toDouble()).toFloat())
      }
    }
    return worst
  }

  private fun blend(a: Int, b: Int, u: Float): Int = Color.rgb(
    (Color.red(a) + (Color.red(b) - Color.red(a)) * u).toInt(),
    (Color.green(a) + (Color.green(b) - Color.green(a)) * u).toInt(),
    (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * u).toInt(),
  )

  private fun mercX(lon: Double) = (lon + 180.0) / 360.0
  private fun mercY(lat: Double) = (1.0 - ln(tan(PI / 4 + lat * PI / 360.0)) / PI) / 2.0

  companion object {
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

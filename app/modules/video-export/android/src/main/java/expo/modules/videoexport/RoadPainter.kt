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

  private val casing = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE; color = Color.WHITE; alpha = 235; strokeWidth = 8f * ratio
    strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
  }
  private val core = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE; color = Color.rgb(0xB3, 0x3A, 0x0A); strokeWidth = 4f * ratio
    strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
  }

  /** Screen position of (lon, lat), pixels, for a camera at (cLon, cLat, zoom). */
  fun project(lon: Double, lat: Double, cLon: Double, cLat: Double, zoom: Double, out: FloatArray) {
    val world = 512.0 * 2.0.pow(zoom) * ratio
    out[0] = ((mercX(lon) - mercX(cLon)) * world + width / 2.0).toFloat()
    out[1] = ((mercY(lat) - mercY(cLat)) * world + height / 2.0).toFloat()
  }

  /** Draws the strokes as the pen has them at `atMs`; returns the points drawn. */
  fun paint(canvas: Canvas, atMs: Double, cLon: Double, cLat: Double, zoom: Double): Int {
    val path = Path()
    val p = FloatArray(2)
    var points = 0
    for (stroke in strokes) {
      val t = stroke.times
      val xy = stroke.lonLat
      if (t[0] > atMs) continue
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
        if (k == 0) path.moveTo(p[0], p[1]) else path.lineTo(p[0], p[1])
        points += 1
        if (beyond) break
      }
    }
    canvas.drawPath(path, casing)
    canvas.drawPath(path, core)
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

  private fun mercX(lon: Double) = (lon + 180.0) / 360.0
  private fun mercY(lat: Double) = (1.0 - ln(tan(PI / 4 + lat * PI / 360.0)) / PI) / 2.0
}

package expo.modules.videoexport

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.geojson.Feature
import org.maplibre.geojson.Point

/**
 * The map's place names, drawn over the roads (T-329, 25 Nov 2026).
 *
 * The roads are painted onto the map's picture, so they covered the names
 * under them: "São V·cente", "M·chico", Funchal gone under its own streets.
 * The video's style keeps the map's label layers placed but all but invisible
 * (`videoPalette.ts`: text-opacity 0.01, since a layer at 0 is not placed at
 * all); after each frame the map is asked which names it placed and where,
 * and they are drawn here, above the roads, with a halo.
 *
 * The map still decides which names fit, so nothing here knows a place (D-017).
 * A name fades in and out over `FADE_FRAMES` frames as the map places and drops
 * it, as the map's own did.
 */
class MapLabels {
  /** One name on one frame: where, how large (points), how strong. */
  class Label(val text: String, val lon: Double, val lat: Double, val size: Float, val kind: Kind, val alpha: Float)

  enum class Kind { TOWN, MAIN_TOWN, ISLAND }

  private class Tracked(var text: String, var lon: Double, var lat: Double, var size: Float, var kind: Kind, var alpha: Float, var seen: Boolean)

  private val tracked = LinkedHashMap<String, Tracked>()

  /** Starts again (the preview looped, or a new video). */
  fun reset() = tracked.clear()

  /**
   * Main thread, after the map has drawn the frame at MapLibre `zoom`: the
   * names it placed, each faded by how long it has been there or gone.
   */
  fun update(map: MapLibreMap, width: Float, height: Float, zoom: Double): List<Label> {
    tracked.values.forEach { it.seen = false }
    val box = RectF(0f, 0f, width, height)
    for (feature in map.queryRenderedFeatures(box, TOWN_LAYER)) {
      val point = feature.geometry() as? Point ?: continue
      val text = name(feature) ?: continue
      val rank = if (feature.hasNonNullValueForProperty("population_rank")) feature.getNumberProperty("population_rank").toDouble() else 0.0
      val main = feature.hasNonNullValueForProperty("min_zoom") && feature.getNumberProperty("min_zoom").toDouble() <= 5.0
      see(text, point, townSize(zoom, rank), if (main) Kind.MAIN_TOWN else Kind.TOWN)
    }
    for (feature in map.queryRenderedFeatures(box, ISLAND_LAYER)) {
      val point = feature.geometry() as? Point ?: continue
      val text = name(feature) ?: continue
      see(text, point, ISLAND_SIZE, Kind.ISLAND)
    }
    val out = ArrayList<Label>(tracked.size)
    val gone = ArrayList<String>()
    for ((key, t) in tracked) {
      t.alpha = (t.alpha + (if (t.seen) 1f else -1f) / FADE_FRAMES).coerceIn(0f, 1f)
      if (t.alpha <= 0f && !t.seen) gone += key else out += Label(t.text, t.lon, t.lat, t.size, t.kind, t.alpha)
    }
    gone.forEach { tracked.remove(it) }
    return out
  }

  private fun see(text: String, point: Point, size: Float, kind: Kind) {
    val key = "$kind|$text"
    val t = tracked[key]
    if (t == null) {
      tracked[key] = Tracked(text, point.longitude(), point.latitude(), size, kind, 0f, true)
    } else {
      t.lon = point.longitude(); t.lat = point.latitude(); t.size = size; t.seen = true
    }
  }

  /** As the style's `text-field`: the Portuguese name, else the name. */
  private fun name(feature: Feature): String? {
    fun text(key: String) = if (feature.hasNonNullValueForProperty(key)) feature.getStringProperty(key)?.takeIf { it.isNotBlank() } else null
    return text("name:pt") ?: text("name")
  }

  /** Draws labels over a frame; one painter per thread. */
  class Painter(private val ratio: Float) {
    private val ink = Color.rgb(0x3A, 0x3A, 0x38)
    private val faces = mapOf(
      Kind.TOWN to Typeface.create("sans-serif", Typeface.NORMAL),
      Kind.MAIN_TOWN to Typeface.create("sans-serif-medium", Typeface.NORMAL),
      Kind.ISLAND to Typeface.create("sans-serif", Typeface.ITALIC),
    )
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
    private val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textAlign = Paint.Align.CENTER; style = Paint.Style.STROKE; strokeJoin = Paint.Join.ROUND; color = Color.WHITE
    }
    private val p = FloatArray(2)

    fun paint(canvas: Canvas, labels: List<Label>, project: (lon: Double, lat: Double, out: FloatArray) -> Unit) {
      for (label in labels) {
        project(label.lon, label.lat, p)
        val size = label.size * ratio
        val island = label.kind == Kind.ISLAND
        for (paint in arrayOf(halo, fill)) {
          paint.typeface = faces.getValue(label.kind)
          paint.textSize = size
          paint.letterSpacing = if (island) 0.1f else 0f
        }
        fill.color = if (island) ISLAND_INK else ink
        fill.alpha = (255 * label.alpha).toInt()
        halo.strokeWidth = HALO * ratio
        halo.alpha = (235 * label.alpha).toInt()
        // Centred on the point, as the style anchors them at the video's zooms.
        val y = p[1] + size * 0.35f
        canvas.drawText(label.text, p[0], y, halo)
        canvas.drawText(label.text, p[0], y, fill)
      }
    }
  }

  companion object {
    const val TOWN_LAYER = "places_locality"
    const val ISLAND_LAYER = "earth_label_islands"
    private const val FADE_FRAMES = 6f
    /** The halo, points: wider than the map's own 1, to stand clear of a road under the name. */
    private const val HALO = 3f
    private const val ISLAND_SIZE = 10f
    private val ISLAND_INK = Color.rgb(0x6F, 0x6D, 0x68)

    /** The style's `text-size` for a town at MapLibre `zoom`: by population rank, between its stops. */
    fun townSize(zoom: Double, rank: Double): Float {
      // (zoom, rank from which a town is "large", small size, large size)
      val stops = arrayOf(
        doubleArrayOf(6.0, 12.0, 11.0, 17.0),
        doubleArrayOf(8.0, 11.0, 11.0, 18.0),
        doubleArrayOf(10.0, 9.0, 12.0, 20.0),
        doubleArrayOf(15.0, 8.0, 12.0, 22.0),
      )
      fun at(s: DoubleArray) = if (rank < s[1]) s[2] else s[3]
      if (zoom <= stops.first()[0]) return at(stops.first()).toFloat()
      for (i in 1 until stops.size) {
        val a = stops[i - 1]; val b = stops[i]
        if (zoom <= b[0]) return (at(a) + (at(b) - at(a)) * (zoom - a[0]) / (b[0] - a[0])).toFloat()
      }
      return at(stops.last()).toFloat()
    }
  }
}

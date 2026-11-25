package expo.modules.videoexport

import org.json.JSONArray
import org.json.JSONObject

/**
 * The job built by `app/src/souvenir/videoJob.ts`: every frame's camera and
 * overlay, the pen's strokes, the watermark island. Parsed once, when the
 * screen hands it over.
 */
class VideoJob(
  val width: Int,
  val height: Int,
  val ratio: Float,
  val fps: Int,
  val appName: String,
  /** [atMs, lon, lat, zoom (MapLibre)] per frame. */
  val frames: List<DoubleArray>,
  /** One per frame: what is drawn over the map. */
  val overlays: JSONArray,
  val strokes: List<RoadPainter.Stroke>,
  val glyph: JSONObject,
) {
  val outW = Math.round(width * ratio)
  val outH = Math.round(height * ratio)

  companion object {
    fun parse(json: String): VideoJob {
      val o = JSONObject(json)
      val f = o.getJSONArray("frames")
      val frames = (0 until f.length()).map { i -> f.getJSONArray(i).let { a -> DoubleArray(4) { a.getDouble(it) } } }
      val s = o.getJSONArray("strokes")
      val strokes = (0 until s.length()).map { i ->
        val stroke = s.getJSONObject(i)
        val c = stroke.getJSONArray("c")
        val t = stroke.getJSONArray("t")
        val lonLat = DoubleArray(c.length() * 2)
        for (k in 0 until c.length()) {
          val p = c.getJSONArray(k)
          lonLat[2 * k] = p.getDouble(0) / 1e5
          lonLat[2 * k + 1] = p.getDouble(1) / 1e5
        }
        RoadPainter.Stroke(lonLat, DoubleArray(t.length()) { t.getDouble(it) })
      }
      return VideoJob(
        o.getInt("width"), o.getInt("height"), o.getDouble("pixelRatio").toFloat(), o.getInt("fps"), o.getString("appName"),
        frames, o.getJSONArray("overlays"), strokes, o.getJSONObject("glyph"),
      )
    }
  }
}

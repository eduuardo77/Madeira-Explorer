package com.proa.videospike

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import org.json.JSONArray
import org.json.JSONObject

/**
 * Draws one frame's overlay, exactly as `app/src/souvenir/videoOverlay.ts` says
 * it is: this file decides only how things look (sizes, colours, places, as in
 * the approved sketch, `tools/lib/video-natural-page.html`), never when they
 * show or what they say.
 *
 * Measures are the sketch's, in points of a 360 x 640 frame; `ratio` turns them
 * into pixels.
 */
class OverlayPainter(
  private val width: Int,
  private val height: Int,
  private val ratio: Float,
  private val appName: String,
  private val glyph: JSONObject,
  private val icon: Bitmap?,
) {
  /** Screen position for (lon, lat) under this frame's camera. */
  private var project: (lon: Double, lat: Double, out: FloatArray) -> Unit = { _, _, _ -> }

  private fun dp(v: Float) = v * ratio
  private val ink = Color.rgb(0x14, 0x20, 0x2B)
  private val sub = Color.rgb(0x4A, 0x55, 0x60)
  private val muted = Color.rgb(0x5A, 0x64, 0x6D)
  private val lit = Color.rgb(0xB3, 0x3A, 0x0A)
  private val bold = Typeface.create("sans-serif", Typeface.BOLD)
  private val medium = Typeface.create("sans-serif-medium", Typeface.NORMAL)
  private val regular = Typeface.create("sans-serif", Typeface.NORMAL)

  private fun text(size: Float, color: Int, face: Typeface, align: Paint.Align = Paint.Align.LEFT) =
    Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = dp(size); this.color = color; typeface = face; textAlign = align }

  private val fill = Paint(Paint.ANTI_ALIAS_FLAG)

  fun paint(canvas: Canvas, o: JSONObject, project: (lon: Double, lat: Double, out: FloatArray) -> Unit) {
    this.project = project
    head(canvas, o.optJSONObject("head"))
    val title = o.getJSONObject("title")
    titleBlock(canvas, title, o.optJSONObject("line"))
    o.optJSONObject("day")?.let { day(canvas, it) }
    o.optJSONObject("pill")?.let { pill(canvas, it, o.optJSONObject("line") != null) }
    o.optJSONObject("card")?.let { card(canvas, it) }
    o.optJSONObject("finale")?.let { finale(canvas, it) }
    watermark(canvas, o.getJSONObject("watermark"))
    o.optJSONObject("endCard")?.let { endCard(canvas, it) }
    canvas.drawText(o.getString("credit"), dp(12f), height - dp(7f), text(8.5f, Color.argb(204, 0x3E, 0x4A, 0x54), regular))
  }

  /** The pen's head: a tail fading backwards, a soft glow, a white core. */
  private fun head(canvas: Canvas, h: JSONObject?) {
    if (h == null) return
    val opacity = h.getDouble("opacity").toFloat()
    if (opacity <= 0.01f) return
    val p = FloatArray(2)
    val tail = h.getJSONArray("tail")
    if (tail.length() >= 2) {
      val path = Path()
      for (i in 0 until tail.length()) {
        val pt = tail.getJSONArray(i)
        project(pt.getDouble(0), pt.getDouble(1), p)
        if (i == 0) path.moveTo(p[0], p[1]) else path.lineTo(p[0], p[1])
      }
      val first = tail.getJSONArray(0); val last = tail.getJSONArray(tail.length() - 1)
      val a = FloatArray(2); val b = FloatArray(2)
      project(first.getDouble(0), first.getDouble(1), a); project(last.getDouble(0), last.getDouble(1), b)
      val glow = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = dp(7f); strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
        shader = LinearGradient(a[0], a[1], b[0], b[1], Color.argb(0, 255, 140, 80), Color.argb((217 * opacity).toInt(), 255, 140, 80), Shader.TileMode.CLAMP)
      }
      canvas.drawPath(path, glow)
    }
    project(h.getDouble("lon"), h.getDouble("lat"), p)
    val scale = h.getDouble("scale").toFloat()
    fill.style = Paint.Style.FILL
    fill.color = Color.argb((140 * opacity).toInt(), 0xFF, 0x9A, 0x5C)
    canvas.drawCircle(p[0], p[1], dp(11f) * scale, fill)
    fill.color = Color.argb((255 * opacity).toInt(), 255, 255, 255)
    canvas.drawCircle(p[0], p[1], dp(3.6f) * (0.6f + 0.4f * scale), fill)
  }

  /** The destination, the dates, and (Discreta) the one line of figures; a soft white veil behind. */
  private fun titleBlock(canvas: Canvas, title: JSONObject, line: JSONObject?) {
    val opacity = title.getDouble("opacity").toFloat()
    if (opacity > 0.01f) {
      val veil = Paint().apply {
        shader = LinearGradient(0f, 0f, 0f, dp(120f), intArrayOf(Color.argb((230 * opacity).toInt(), 255, 255, 255), Color.argb((128 * opacity).toInt(), 255, 255, 255), Color.argb(0, 255, 255, 255)), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
      }
      canvas.drawRect(0f, 0f, width.toFloat(), dp(120f), veil)
      val dy = dp(title.getDouble("offsetY").toFloat())
      canvas.drawText(title.getString("text"), dp(20f), dp(48f) + dy, text(28f, ink, bold).withAlpha(opacity))
      canvas.drawText(title.getString("dates"), dp(20f), dp(66f) + dy, text(12.5f, sub, medium).withAlpha(opacity))
    }
    if (line != null) {
      val o = line.getDouble("opacity").toFloat()
      if (o > 0.01f) canvas.drawText(line.getString("text"), dp(20f), dp(84f), text(13f, lit, bold).withAlpha(o))
    }
  }

  private fun day(canvas: Canvas, d: JSONObject) {
    val o = d.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    // The day on the title's row, its date on the figures' row: the trip's dates
    // run long under the title and met the date when it sat right under the day.
    canvas.drawText(d.getString("text"), width - dp(16f), dp(46f), text(15f, ink, bold, Paint.Align.RIGHT).withAlpha(o))
    canvas.drawText(d.getString("date"), width - dp(16f), dp(84f), text(12f, sub, medium, Paint.Align.RIGHT).withAlpha(o))
  }

  /** A stamp's name, in a white pill with a red tick. */
  private fun pill(canvas: Canvas, p: JSONObject, underLine: Boolean) {
    val o = p.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    val name = text(13f, ink, bold).withAlpha(o)
    val more = text(12f, muted, medium).withAlpha(o)
    val moreText = p.getString("more")
    val w = dp(6f + 20f + 8f) + name.measureText(p.getString("name")) + (if (moreText.isEmpty()) 0f else dp(8f) + more.measureText(moreText)) + dp(13f)
    val left = dp(20f) + dp(p.getDouble("offsetX").toFloat())
    val top = dp(if (underLine) 96f else 84f)
    val h = dp(30f)
    fill.style = Paint.Style.FILL
    fill.setShadowLayer(dp(5f), 0f, dp(1f), Color.argb((36 * o).toInt(), 0, 0, 0))
    fill.color = Color.argb((245 * o).toInt(), 255, 255, 255)
    canvas.drawRoundRect(RectF(left, top, left + w, top + h), h / 2, h / 2, fill)
    fill.clearShadowLayer()
    fill.color = Color.argb((255 * o).toInt(), 0xB3, 0x3A, 0x0A)
    canvas.drawCircle(left + dp(16f), top + h / 2, dp(10f), fill)
    val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = dp(2f); color = Color.argb((255 * o).toInt(), 255, 255, 255); strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND }
    canvas.drawPath(Path().apply { moveTo(left + dp(11.5f), top + h / 2); lineTo(left + dp(15f), top + h / 2 + dp(3.5f)); lineTo(left + dp(21f), top + h / 2 - dp(3.5f)) }, tick)
    val baseline = top + h / 2 + dp(4.5f)
    val nameLeft = left + dp(34f)
    canvas.drawText(p.getString("name"), nameLeft, baseline, name)
    if (moreText.isNotEmpty()) canvas.drawText(moreText, nameLeft + name.measureText(p.getString("name")) + dp(8f), baseline, more)
  }

  /** Completa: the card at the foot. */
  private fun card(canvas: Canvas, c: JSONObject) {
    val o = c.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    val dy = dp(c.getDouble("offsetY").toFloat())
    val r = RectF(dp(14f), height - dp(26f) - dp(84f) + dy, width - dp(14f), height - dp(26f) + dy)
    panel(canvas, r, o)
    val half = (r.width() - dp(36f)) / 2
    val x1 = r.left + dp(18f); val x2 = x1 + half + dp(18f)
    canvas.drawText(c.getString("km"), x1, r.top + dp(42f), text(30f, lit, bold).withAlpha(o))
    canvas.drawText(c.getString("kmLabel"), x1, r.top + dp(60f), text(12f, muted, medium).withAlpha(o))
    canvas.drawText(c.getString("stamps"), x2, r.top + dp(42f), text(30f, lit, bold).withAlpha(o))
    canvas.drawText(c.getString("stampsLabel"), x2, r.top + dp(60f), text(12f, muted, medium).withAlpha(o))
    fill.style = Paint.Style.FILL
    fill.color = Color.argb((255 * o).toInt(), 0xEC, 0xE8, 0xDF)
    val bar = RectF(x1, r.bottom - dp(15f), r.right - dp(18f), r.bottom - dp(12f))
    canvas.drawRoundRect(bar, dp(2f), dp(2f), fill)
    fill.color = Color.argb((255 * o).toInt(), 0xB3, 0x3A, 0x0A)
    canvas.drawRoundRect(RectF(bar.left, bar.top, bar.left + bar.width() * c.getDouble("progress").toFloat(), bar.bottom), dp(2f), dp(2f), fill)
  }

  /** Completa: the closing card, the count rising. */
  private fun finale(canvas: Canvas, f: JSONObject) {
    val o = f.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    val dy = dp(f.getDouble("offsetY").toFloat())
    val r = RectF(dp(14f), height - dp(26f) - dp(130f) + dy, width - dp(14f), height - dp(26f) + dy)
    panel(canvas, r, o)
    val big = text(60f, ink, bold).withAlpha(o)
    val small = text(26f, muted, medium).withAlpha(o)
    val count = f.getString("count"); val total = f.getString("total")
    val w = big.measureText(count) + small.measureText(total)
    val x = r.centerX() - w / 2
    canvas.drawText(count, x, r.top + dp(66f), big)
    canvas.drawText(total, x + big.measureText(count), r.top + dp(66f), small)
    canvas.drawText(f.getString("placesLabel"), r.centerX(), r.top + dp(90f), text(14f, ink, bold, Paint.Align.CENTER).withAlpha(o))
    canvas.drawText(f.getString("km"), r.centerX(), r.top + dp(110f), text(13f, muted, regular, Paint.Align.CENTER).withAlpha(o))
  }

  private fun panel(canvas: Canvas, r: RectF, o: Float) {
    fill.style = Paint.Style.FILL
    fill.setShadowLayer(dp(9f), 0f, dp(2f), Color.argb((30 * o).toInt(), 0, 0, 0))
    fill.color = Color.argb((222 * o).toInt(), 255, 255, 255)
    canvas.drawRoundRect(r, dp(20f), dp(20f), fill)
    fill.clearShadowLayer()
  }

  /** The white signature: the island, a hairline, the name. Free: large, low in the frame; paid: small, in a corner. */
  private fun watermark(canvas: Canvas, w: JSONObject) {
    val o = w.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    val free = w.getString("tier") == "free"
    val size = if (free) 42f else 10f
    val glyphW = dp(if (free) 78f else 17f)
    val gap = dp(if (free) 18f else 5f)
    val name = text(size, Color.WHITE, bold).apply {
      letterSpacing = if (free) 0.12f else 0.08f
      setShadowLayer(dp(if (free) 3f else 1.5f), 0f, dp(1f), Color.argb(120, 0, 0, 0))
      alpha = ((if (free) 237 else 217) * o).toInt()
    }
    val label = appName.uppercase()
    val glyphH = glyphW * (glyph.getDouble("height") / glyph.getDouble("width")).toFloat()
    val total = glyphW + gap * 2 + dp(2f) + name.measureText(label)
    val left: Float; val centreY: Float
    if (free) { left = (width - total) / 2; centreY = height * 0.66f } else { left = width - dp(12f) - total; centreY = height - dp(11f) }
    // The island.
    val shape = Path()
    val rings = glyph.getJSONArray("rings")
    val k = glyphW / glyph.getDouble("width").toFloat()
    for (i in 0 until rings.length()) {
      val ring = rings.getJSONArray(i)
      for (j in 0 until ring.length()) {
        val pt = ring.getJSONArray(j)
        val x = left + pt.getDouble(0).toFloat() * k
        val y = centreY - glyphH / 2 + pt.getDouble(1).toFloat() * k
        if (j == 0) shape.moveTo(x, y) else shape.lineTo(x, y)
      }
      shape.close()
    }
    fill.style = Paint.Style.FILL
    fill.color = Color.WHITE
    fill.alpha = name.alpha
    fill.setShadowLayer(dp(if (free) 3f else 1.5f), 0f, dp(1f), Color.argb(120, 0, 0, 0))
    canvas.drawPath(shape, fill)
    // The hairline (free only), then the name.
    if (free) canvas.drawRect(left + glyphW + gap, centreY - dp(15f), left + glyphW + gap + dp(2f), centreY + dp(15f), fill)
    fill.clearShadowLayer()
    val textX = left + glyphW + (if (free) gap * 2 + dp(2f) else gap)
    canvas.drawText(label, textX, centreY + name.textSize * 0.36f, name)
  }

  /** Free only: the closing card over a veiled map. */
  private fun endCard(canvas: Canvas, e: JSONObject) {
    val o = e.getDouble("opacity").toFloat()
    if (o <= 0.01f) return
    val s = e.getDouble("scale").toFloat()
    fill.style = Paint.Style.FILL
    fill.color = Color.argb((219 * o).toInt(), 250, 248, 243)
    canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), fill)
    canvas.save()
    canvas.scale(s, s, width / 2f, height / 2f)
    val cy = height / 2f
    if (icon != null) {
      val size = dp(72f)
      val r = RectF(width / 2f - size / 2, cy - dp(110f), width / 2f + size / 2, cy - dp(110f) + size)
      val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply { alpha = (255 * o).toInt() }
      canvas.save()
      canvas.clipPath(Path().apply { addRoundRect(r, dp(18f), dp(18f), Path.Direction.CW) })
      canvas.drawBitmap(icon, null, r, p)
      canvas.restore()
    }
    canvas.drawText(appName, width / 2f, cy + dp(12f), text(44f, ink, bold, Paint.Align.CENTER).withAlpha(o))
    canvas.drawText(e.getString("text"), width / 2f, cy + dp(40f), text(14f, muted, regular, Paint.Align.CENTER).withAlpha(o))
    canvas.restore()
  }

  private fun Paint.withAlpha(o: Float): Paint = apply { alpha = (Color.alpha(color) * o).toInt().coerceIn(0, 255) }
}

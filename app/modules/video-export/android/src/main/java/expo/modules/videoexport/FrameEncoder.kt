package expo.modules.videoexport

import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.util.concurrent.Callable
import java.util.concurrent.Executors

/**
 * Frames in, an H.264 MP4 out. Every call is made from one thread (the caller's
 * worker), as MediaCodec wants.
 *
 * Frames go to the encoder as YUV 4:2:0 buffers stamped `n / fps`. Drawing into
 * the encoder's input Surface instead was dropped during the spike: with its own
 * clock out of our hands it is the less portable route.
 *
 * The RGB to YUV conversion (BT.601, limited range) runs in horizontal bands on
 * `CONVERT_THREADS` threads into plain arrays, then goes into the encoder's
 * buffers in bulk. Writing it a byte at a time into the buffers was most of the
 * frame time.
 */
class FrameEncoder(private val width: Int, private val height: Int, private val fps: Int, private val output: File) {
  private val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
  private val muxer = MediaMuxer(output.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
  private val pool = Executors.newFixedThreadPool(CONVERT_THREADS)
  private val argb = IntArray(width * height)
  private var yRows = ByteArray(0)
  private var uRows = ByteArray(0)
  private var vRows = ByteArray(0)
  private var track = -1
  private var muxing = false
  private var queued = 0
  var written = 0
    private set
  /** How the encoder lays its chroma out, for the record: "semi-planar" or "planar". */
  var chromaLayout = "?"
    private set

  init {
    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
    codec.start()
  }

  fun add(picture: Bitmap) {
    picture.getPixels(argb, 0, width, 0, 0, width, height)
    val input = nextInput()
    val image = codec.getInputImage(input)!!
    val (y, u, v) = Triple(image.planes[0], image.planes[1], image.planes[2])
    val semi = u.pixelStride == 2
    chromaLayout = if (semi) "semi-planar" else "planar"
    if (yRows.size != y.rowStride * height) yRows = ByteArray(y.rowStride * height)
    val chromaSize = u.rowStride * (height / 2)
    if (uRows.size != chromaSize) { uRows = ByteArray(chromaSize); vRows = ByteArray(chromaSize) }

    val band = (height / 2 + CONVERT_THREADS - 1) / CONVERT_THREADS // in chroma rows
    pool.invokeAll((0 until CONVERT_THREADS).map { b ->
      Callable { convert(b * band, minOf(height / 2, (b + 1) * band), y.rowStride, u.rowStride, semi) }
    })

    y.buffer.put(yRows, 0, minOf(yRows.size, y.buffer.remaining()))
    if (semi) {
      // U and V share one interleaved buffer; the U plane's view starts at U.
      u.buffer.put(uRows, 0, minOf(uRows.size, u.buffer.remaining()))
    } else {
      u.buffer.put(uRows, 0, minOf(uRows.size, u.buffer.remaining()))
      v.buffer.put(vRows, 0, minOf(vRows.size, v.buffer.remaining()))
    }
    codec.queueInputBuffer(input, 0, width * height * 3 / 2, queued * 1_000_000L / fps, 0)
    queued += 1
    drain(false)
  }

  /** Chroma rows [from, to), with the two luma rows over each. */
  private fun convert(from: Int, to: Int, yStride: Int, cStride: Int, semi: Boolean) {
    for (cr in from until to) {
      for (dy in 0..1) {
        val row = 2 * cr + dy
        var src = row * width
        var dst = row * yStride
        for (col in 0 until width) {
          val c = argb[src++]
          val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
          yRows[dst++] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).toByte()
        }
      }
      val base = (2 * cr) * width
      val out = cr * cStride
      for (col in 0 until width / 2) {
        val c = argb[base + 2 * col]
        val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
        val cb = (((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128).toByte()
        val crr = (((112 * r - 94 * g - 18 * b + 128) shr 8) + 128).toByte()
        if (semi) { uRows[out + 2 * col] = cb; if (out + 2 * col + 1 < uRows.size) uRows[out + 2 * col + 1] = crr }
        else { uRows[out + col] = cb; vRows[out + col] = crr }
      }
    }
  }

  fun finish() {
    val input = nextInput()
    codec.queueInputBuffer(input, 0, 0, queued * 1_000_000L / fps, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
    drain(true)
    codec.stop(); codec.release()
    if (muxing) muxer.stop()
    muxer.release()
    pool.shutdown()
  }

  private fun nextInput(): Int {
    while (true) {
      val input = codec.dequeueInputBuffer(10_000)
      if (input >= 0) return input
      drain(false)
    }
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

  private companion object {
    const val BIT_RATE = 10_000_000
    const val CONVERT_THREADS = 4
  }
}

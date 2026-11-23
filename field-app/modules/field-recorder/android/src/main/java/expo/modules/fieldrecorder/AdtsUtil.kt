package expo.modules.fieldrecorder

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * AAC ADTS 파일 다루기.
 * - 프레임 수로 정확한 길이를 잰다(끝이 잘린 파일도 마지막 온전한 프레임까지).
 * - 여러 조각에서 원하는 시간 구간만 잘라 탐색 가능한 .m4a로 만든다(MediaMuxer).
 */
object AdtsUtil {
  private val RATES = intArrayOf(96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350)

  class Parsed(
    val bytes: ByteArray,
    /** [payloadStart, payloadLength] */
    val frames: List<IntArray>,
    val sampleRate: Int,
    val sampleRateIndex: Int,
    val channels: Int,
    val profile: Int,
  ) {
    val frameDurationMs: Double get() = 1024.0 * 1000.0 / sampleRate
    val durationMs: Long get() = (frames.size * frameDurationMs).toLong()
  }

  fun parse(file: File): Parsed {
    val bytes = file.readBytes()
    val frames = ArrayList<IntArray>(bytes.size / 180 + 1)
    var sr = 44100
    var sri = 4
    var ch = 1
    var prof = 1
    var first = true
    var i = 0
    val n = bytes.size
    while (i + 7 <= n) {
      val b0 = bytes[i].toInt() and 0xFF
      val b1 = bytes[i + 1].toInt() and 0xFF
      if (b0 != 0xFF || (b1 and 0xF6) != 0xF0) { i++; continue }
      val protectionAbsent = b1 and 0x01
      val b2 = bytes[i + 2].toInt() and 0xFF
      val b3 = bytes[i + 3].toInt() and 0xFF
      val b4 = bytes[i + 4].toInt() and 0xFF
      val b5 = bytes[i + 5].toInt() and 0xFF
      val profile = (b2 shr 6) and 0x3
      val sfi = (b2 shr 2) and 0xF
      val chCfg = ((b2 and 0x1) shl 2) or ((b3 shr 6) and 0x3)
      val frameLen = ((b3 and 0x3) shl 11) or (b4 shl 3) or ((b5 shr 5) and 0x7)
      val headerLen = if (protectionAbsent == 1) 7 else 9
      if (sfi >= RATES.size || frameLen <= headerLen) { i++; continue }
      if (i + frameLen > n) break // 강제 종료로 잘린 마지막 프레임
      if (first) {
        sr = RATES[sfi]; sri = sfi; ch = if (chCfg == 0) 1 else chCfg; prof = profile
        first = false
      } else if (sfi != sri) {
        i++; continue
      }
      frames.add(intArrayOf(i + headerLen, frameLen - headerLen))
      i += frameLen
    }
    return Parsed(bytes, frames, sr, sri, ch, prof)
  }

  fun durationMs(file: File): Long = try { parse(file).durationMs } catch (_: Throwable) { 0L }

  class Segment(val path: String, val startMs: Long)

  class ClipResult(val path: String, val startMs: Long, val endMs: Long, val durationMs: Long)

  /**
   * segments(시작 시각 순) 중 [fromMs, toMs] 구간을 잘라 outPath(.m4a)로 저장한다.
   * fromMs/toMs가 null이면 전체를 합친다.
   */
  fun writeM4a(segments: List<Segment>, fromMs: Long?, toMs: Long?, outPath: String): ClipResult? {
    val out = File(outPath)
    out.parentFile?.mkdirs()
    if (out.exists()) out.delete()

    var muxer: MediaMuxer? = null
    var track = -1
    var ptsUs = 0L
    var clipStart = -1L
    var clipEnd = -1L
    var buf = ByteBuffer.allocateDirect(8192)
    val info = MediaCodec.BufferInfo()
    var started = false

    try {
      for (seg in segments.sortedBy { it.startMs }) {
        val f = File(seg.path)
        if (!f.exists()) continue
        val p = parse(f)
        if (p.frames.isEmpty()) continue
        val fd = p.frameDurationMs
        val segEnd = seg.startMs + p.durationMs
        if (fromMs != null && segEnd <= fromMs) continue
        if (toMs != null && seg.startMs >= toMs) continue

        val firstIdx = if (fromMs != null) max(0, floor((fromMs - seg.startMs) / fd).toInt()) else 0
        val lastIdx = if (toMs != null) min(p.frames.size, ceil((toMs - seg.startMs) / fd).toInt()) else p.frames.size
        if (firstIdx >= lastIdx) continue

        if (muxer == null) {
          muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
          val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, p.sampleRate, p.channels)
          val aot = p.profile + 1
          val csd = byteArrayOf(
            ((aot shl 3) or (p.sampleRateIndex shr 1)).toByte(),
            (((p.sampleRateIndex and 1) shl 7) or (p.channels shl 3)).toByte()
          )
          fmt.setByteBuffer("csd-0", ByteBuffer.wrap(csd))
          track = muxer.addTrack(fmt)
          muxer.start()
          started = true
        }
        if (clipStart < 0) clipStart = seg.startMs + (firstIdx * fd).toLong()
        val frameUs = (1024L * 1_000_000L) / p.sampleRate
        for (k in firstIdx until lastIdx) {
          val fr = p.frames[k]
          val len = fr[1]
          if (buf.capacity() < len) buf = ByteBuffer.allocateDirect(len * 2)
          buf.clear()
          buf.put(p.bytes, fr[0], len)
          buf.flip()
          info.set(0, len, ptsUs, MediaCodec.BUFFER_FLAG_KEY_FRAME)
          muxer!!.writeSampleData(track, buf, info)
          ptsUs += frameUs
        }
        clipEnd = seg.startMs + (lastIdx * fd).toLong()
      }
    } finally {
      try { if (started) muxer?.stop() } catch (_: Throwable) {}
      try { muxer?.release() } catch (_: Throwable) {}
    }
    if (!started) {
      if (out.exists()) out.delete()
      return null
    }
    return ClipResult(outPath, clipStart, clipEnd, ptsUs / 1000)
  }
}

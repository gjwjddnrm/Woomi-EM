package expo.modules.fieldrecorder

import android.media.MediaCodec
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

/**
 * 녹음 조각의 소리 크기 기록(chunk_<시작>.lvl, 0.25초당 1바이트 = dB*2.8)으로
 * 말소리 구간을 찾고, 그 구간만 이어 붙인 m4a를 만든다.
 * 녹음 자체는 끊지 않는다(말 첫마디를 놓치지 않기 위해). 무음 건너뛰기는 변환·재생 단계에서만 한다.
 */
object SpeechUtil {
  const val STEP_MS = 250L
  private const val PAD_BEFORE_MS = 1000L
  private const val PAD_AFTER_MS = 1200L
  private const val MERGE_GAP_MS = 2500L
  private const val MIN_SPAN_MS = 500L

  fun levelFileFor(audio: File): File = File(audio.parentFile, audio.name.removeSuffix(".aac") + ".lvl")

  /**
   * 말소리 구간 [시작ms, 끝ms, ...] (조각 시작 기준).
   * 기록이 없거나 진폭을 못 읽는 기기면 null(= 알 수 없음, 전체를 써야 함).
   */
  fun speechSpans(audio: File, durationMs: Long): LongArray? {
    val lf = levelFileFor(audio)
    if (!lf.exists()) return null
    val v = lf.readBytes().map { (it.toInt() and 0xFF) / 2.8 }
    if (v.size < 4) return null
    if ((v.maxOrNull() ?: 0.0) < 5.0) return null // 진폭이 전부 0 → 측정 불가 기기
    val sorted = v.sorted()
    val floor = sorted[(sorted.size * 0.2).toInt().coerceAtMost(sorted.size - 1)]
    val thr = maxOf(floor + 10.0, 48.0)

    val spans = ArrayList<LongArray>()
    var i = 0
    while (i < v.size) {
      if (v[i] > thr) {
        var j = i
        while (j + 1 < v.size && v[j + 1] > thr - 4.0) j++
        val s = (i * STEP_MS - PAD_BEFORE_MS).coerceAtLeast(0L)
        val e = ((j + 1) * STEP_MS + PAD_AFTER_MS).coerceAtMost(maxOf(durationMs, (v.size) * STEP_MS))
        if (spans.isNotEmpty() && s - spans.last()[1] <= MERGE_GAP_MS) spans.last()[1] = maxOf(spans.last()[1], e)
        else spans.add(longArrayOf(s, e))
        i = j + 1
      } else i++
    }
    val out = ArrayList<Long>()
    for (sp in spans) if (sp[1] - sp[0] >= MIN_SPAN_MS) { out.add(sp[0]); out.add(sp[1]) }
    return out.toLongArray()
  }

  /** spans(조각 기준 ms) 부분만 이어 붙여 m4a로 저장. 길이(ms)를 돌려준다. */
  fun writeSpansM4a(audio: File, spans: LongArray, outPath: String): Long {
    val p = AdtsUtil.parse(audio)
    if (p.frames.isEmpty() || spans.isEmpty()) return 0L
    val out = File(outPath)
    out.parentFile?.mkdirs()
    if (out.exists()) out.delete()
    val muxer = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    var started = false
    var ptsUs = 0L
    try {
      val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, p.sampleRate, p.channels)
      val aot = p.profile + 1
      fmt.setByteBuffer(
        "csd-0",
        ByteBuffer.wrap(byteArrayOf(((aot shl 3) or (p.sampleRateIndex shr 1)).toByte(), (((p.sampleRateIndex and 1) shl 7) or (p.channels shl 3)).toByte()))
      )
      val track = muxer.addTrack(fmt)
      muxer.start()
      started = true
      val fd = p.frameDurationMs
      val frameUs = (1024L * 1_000_000L) / p.sampleRate
      var buf = ByteBuffer.allocateDirect(8192)
      val info = MediaCodec.BufferInfo()
      var k = 0
      while (k + 1 < spans.size) {
        val a = (spans[k] / fd).toInt().coerceIn(0, p.frames.size)
        val b = Math.ceil(spans[k + 1] / fd).toInt().coerceIn(0, p.frames.size)
        for (f in a until b) {
          val fr = p.frames[f]
          if (buf.capacity() < fr[1]) buf = ByteBuffer.allocateDirect(fr[1] * 2)
          buf.clear(); buf.put(p.bytes, fr[0], fr[1]); buf.flip()
          info.set(0, fr[1], ptsUs, MediaCodec.BUFFER_FLAG_KEY_FRAME)
          muxer.writeSampleData(track, buf, info)
          ptsUs += frameUs
        }
        k += 2
      }
    } finally {
      try { if (started) muxer.stop() } catch (_: Throwable) {}
      try { muxer.release() } catch (_: Throwable) {}
    }
    return ptsUs / 1000
  }
}

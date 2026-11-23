package expo.modules.fieldrecorder

import android.content.ContentValues
import android.content.Context
import android.os.Build
import android.provider.MediaStore
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

object ExportUtil {
  /** 사진을 갤러리 '사진/현장점검/<폴더>'에 저장. 저장한 개수를 돌려준다. (Android 10 이상, 권한 불필요) */
  fun saveToGallery(ctx: Context, paths: List<String>, names: List<String>, folder: String): Int {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) throw IllegalStateException("안드로이드 10 이상에서만 지원합니다")
    val resolver = ctx.contentResolver
    val safeFolder = folder.replace(Regex("[\\\\/:*?\"<>|]"), "_").trim().ifEmpty { "점검" }
    var saved = 0
    for (i in paths.indices) {
      val src = File(paths[i])
      if (!src.exists()) continue
      val values = ContentValues().apply {
        put(MediaStore.Images.Media.DISPLAY_NAME, names[i])
        put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
        put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/현장점검/$safeFolder")
        put(MediaStore.Images.Media.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: continue
      try {
        resolver.openOutputStream(uri)?.use { out -> FileInputStream(src).use { it.copyTo(out) } }
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        saved++
      } catch (e: Throwable) {
        try { resolver.delete(uri, null, null) } catch (_: Throwable) {}
      }
    }
    return saved
  }

  /** files: [실제 경로, ZIP 안의 이름] 목록, texts: [ZIP 안의 이름, 내용(UTF-8)] */
  fun zip(paths: List<String>, names: List<String>, textNames: List<String>, texts: List<String>, outPath: String): Long {
    val out = File(outPath)
    out.parentFile?.mkdirs()
    if (out.exists()) out.delete()
    ZipOutputStream(FileOutputStream(out)).use { z ->
      for (i in textNames.indices) {
        z.putNextEntry(ZipEntry(textNames[i]))
        z.write(texts[i].toByteArray(Charsets.UTF_8))
        z.closeEntry()
      }
      for (i in paths.indices) {
        val f = File(paths[i])
        if (!f.exists()) continue
        z.putNextEntry(ZipEntry(names[i]))
        FileInputStream(f).use { it.copyTo(z) }
        z.closeEntry()
      }
    }
    return out.length()
  }
}

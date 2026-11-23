package expo.modules.fieldrecorder

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.os.StatFs
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class FieldRecorderModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "React context is not available", null)

  override fun definition() = ModuleDefinition {
    Name("FieldRecorder")

    Events("onVolumeKey")

    OnCreate {
      VolumeKeyBridge.listener = { key -> sendEvent("onVolumeKey", mapOf("key" to key)) }
    }

    OnDestroy {
      VolumeKeyBridge.enabled = false
      VolumeKeyBridge.listener = null
    }

    // ── 녹음 ──
    AsyncFunction("start") { sessionId: String, dir: String, site: String, startedAt: Double ->
      val ctx = context
      File(dir).mkdirs()
      val intent = Intent(ctx, RecorderService::class.java).apply {
        action = RecorderService.ACTION_START
        putExtra(RecorderService.EXTRA_SESSION_ID, sessionId)
        putExtra(RecorderService.EXTRA_DIR, dir)
        putExtra(RecorderService.EXTRA_SITE, site)
        putExtra(RecorderService.EXTRA_STARTED_AT, startedAt.toLong())
      }
      ContextCompat.startForegroundService(ctx, intent)
      // 실제로 녹음이 시작될 때까지 최대 4초 기다린다
      val deadline = System.currentTimeMillis() + 4000
      while (System.currentTimeMillis() < deadline) {
        if (RecorderState.running && RecorderState.sessionId == sessionId &&
          (RecorderState.phase == "recording" || RecorderState.phase == "interrupted")) break
        if (RecorderState.phase == "error") break
        Thread.sleep(100)
      }
      RecorderState.toMap()
    }

    AsyncFunction("stop") {
      val ctx = context
      if (RecorderState.running) {
        val intent = Intent(ctx, RecorderService::class.java).apply { action = RecorderService.ACTION_STOP }
        try {
          ctx.startService(intent)
        } catch (_: Throwable) {
          ctx.stopService(Intent(ctx, RecorderService::class.java))
        }
        val deadline = System.currentTimeMillis() + 5000
        while (System.currentTimeMillis() < deadline && RecorderState.running) Thread.sleep(100)
      }
      RecorderState.toMap()
    }

    Function("getStatus") {
      RecorderState.toMap()
    }

    // ── 녹음 파일 ──
    AsyncFunction("listChunks") { dir: String ->
      val re = Regex("^chunk_(\\d+)\\.aac$")
      val current = RecorderState.currentChunkPath
      (File(dir).listFiles() ?: emptyArray())
        .mapNotNull { f ->
          val m = re.matchEntire(f.name) ?: return@mapNotNull null
          val start = m.groupValues[1].toLongOrNull() ?: return@mapNotNull null
          val dur = AdtsUtil.durationMs(f)
          if (dur <= 0L) return@mapNotNull null
          mapOf(
            "path" to f.absolutePath,
            "startMs" to start.toDouble(),
            "durationMs" to dur.toDouble(),
            "size" to f.length().toDouble(),
            "active" to (f.absolutePath == current),
          )
        }
        .sortedBy { it["startMs"] as Double }
    }

    AsyncFunction("writeClip") { paths: List<String>, starts: List<Double>, fromMs: Double, toMs: Double, outPath: String ->
      val segs = paths.indices.map { AdtsUtil.Segment(paths[it], starts[it].toLong()) }
      val r = AdtsUtil.writeM4a(segs, fromMs.toLong(), toMs.toLong(), outPath)
      if (r == null) null else mapOf(
        "path" to r.path, "startMs" to r.startMs.toDouble(), "endMs" to r.endMs.toDouble(), "durationMs" to r.durationMs.toDouble()
      )
    }

    AsyncFunction("mergeToM4a") { paths: List<String>, starts: List<Double>, outPath: String ->
      val segs = paths.indices.map { AdtsUtil.Segment(paths[it], starts[it].toLong()) }
      val r = AdtsUtil.writeM4a(segs, null, null, outPath)
      if (r == null) null else mapOf(
        "path" to r.path, "startMs" to r.startMs.toDouble(), "endMs" to r.endMs.toDouble(), "durationMs" to r.durationMs.toDouble()
      )
    }

    // ── 기기 상태 ──
    Function("getDeviceHealth") {
      val ctx = context
      val bi = ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
      val level = bi?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
      val scale = bi?.getIntExtra(BatteryManager.EXTRA_SCALE, 100) ?: 100
      val plugged = (bi?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0) != 0
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      val free = try { StatFs(ctx.filesDir.path).availableBytes } catch (_: Throwable) { -1L }
      mapOf(
        "batteryPct" to (if (level >= 0 && scale > 0) level * 100 / scale else -1),
        "charging" to plugged,
        "powerSaveMode" to pm.isPowerSaveMode,
        "ignoringBatteryOptimizations" to pm.isIgnoringBatteryOptimizations(ctx.packageName),
        "freeBytes" to free.toDouble(),
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "sdk" to Build.VERSION.SDK_INT,
      )
    }

    Function("requestIgnoreBatteryOptimizations") {
      val ctx = context
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (pm.isIgnoringBatteryOptimizations(ctx.packageName)) return@Function true
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))
      launch(intent) || launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
    }

    Function("openAppSettings") {
      launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    /** 삼성 '배터리' 화면(절전 예외 앱 목록이 있는 곳)을 연다. 못 열면 일반 배터리 최적화 화면으로. */
    Function("openSamsungBatterySettings") {
      val candidates = listOf(
        ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
        ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"),
        ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"),
      )
      for (c in candidates) {
        if (launch(Intent().setComponent(c))) return@Function "samsung"
      }
      if (launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) return@Function "generic"
      if (launch(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))) return@Function "app"
      "none"
    }

    // ── 볼륨 버튼 셔터 ──
    Function("setVolumeKeyCapture") { enabled: Boolean ->
      VolumeKeyBridge.enabled = enabled
    }
  }

  private fun launch(intent: Intent): Boolean {
    return try {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      true
    } catch (_: Throwable) {
      false
    }
  }
}

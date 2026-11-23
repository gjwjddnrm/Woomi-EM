package expo.modules.fieldrecorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.StatFs
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.File

/**
 * 점검 녹음 Foreground Service.
 *
 * - 1분마다 새 파일(AAC ADTS)로 나눠 저장한다. ADTS는 파일이 중간에 끊겨도 앞부분을 그대로 재생할 수 있어서,
 *   앱이 강제 종료돼도 마지막 파일의 직전까지 남는다.
 * - 녹음기 오류가 나면 3초 뒤 자동으로 다시 시작한다.
 * - 통화가 시작되면 상태를 '통화 중'으로 바꾸고, 통화가 끝나면 새 파일로 깨끗하게 다시 시작한다.
 * - 저장공간·배터리를 주기적으로 확인해 알림에 경고를 띄운다.
 * - 시스템이 서비스를 죽였다가 다시 살리면(START_STICKY) 저장해 둔 설정으로 이어서 녹음한다.
 */
class RecorderService : Service() {
  companion object {
    const val TAG = "FieldRecorder"
    const val ACTION_START = "expo.modules.fieldrecorder.START"
    const val ACTION_STOP = "expo.modules.fieldrecorder.STOP"
    const val EXTRA_SESSION_ID = "sessionId"
    const val EXTRA_DIR = "dir"
    const val EXTRA_SITE = "site"
    const val EXTRA_STARTED_AT = "startedAt"

    const val CHANNEL_ID = "field_recording"
    const val ALERT_CHANNEL_ID = "field_recording_alert"
    const val NOTIF_ID = 4101
    const val ALERT_NOTIF_ID = 4102

    const val CHUNK_MS = 60_000L
    const val WATCHDOG_MS = 2_000L
    const val RETRY_MS = 3_000L
    const val STALL_MS = 15_000L

    const val LOW_STORAGE_BYTES = 300L * 1024 * 1024
    const val CRITICAL_STORAGE_BYTES = 30L * 1024 * 1024

    const val PREFS = "field_recorder"
  }

  private lateinit var thread: HandlerThread
  private lateinit var handler: Handler
  private var wakeLock: PowerManager.WakeLock? = null

  private var recorder: MediaRecorder? = null
  private var currentFile: File? = null

  private var sessionId: String? = null
  private var dir: String? = null
  private var site: String = ""
  private var startedAt: Long = 0L

  private var inCall = false
  private var callCandidateSince = 0L
  private var lastSizeCheckBytes = -1L
  private var lastGrowthAt = 0L
  private var lastHealthCheckAt = 0L
  private var batteryAlerted15 = false
  private var batteryAlerted5 = false
  private var storageAlerted = false
  private var lastNotifText: String? = null

  private val rotateRunnable = Runnable { rotate("timer") }
  private var retryScheduled = false
  private val retryRunnable = Runnable {
    retryScheduled = false
    if (RecorderState.running && recorder == null && !inCall) startChunk()
  }

  private fun scheduleRetry(delayMs: Long) {
    handler.removeCallbacks(retryRunnable)
    retryScheduled = true
    handler.postDelayed(retryRunnable, delayMs)
  }
  private val watchdogRunnable = object : Runnable {
    override fun run() {
      try { watchdog() } catch (e: Throwable) { Log.e(TAG, "watchdog", e) }
      if (RecorderState.running) handler.postDelayed(this, WATCHDOG_MS)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    thread = HandlerThread("FieldRecorderThread").also { it.start() }
    handler = Handler(thread.looper)
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      handler.post { shutdown() }
      return START_NOT_STICKY
    }

    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val cfgSession: String?
    val cfgDir: String?
    val cfgSite: String
    val cfgStarted: Long
    if (intent?.action == ACTION_START) {
      cfgSession = intent.getStringExtra(EXTRA_SESSION_ID)
      cfgDir = intent.getStringExtra(EXTRA_DIR)
      cfgSite = intent.getStringExtra(EXTRA_SITE) ?: ""
      cfgStarted = intent.getLongExtra(EXTRA_STARTED_AT, System.currentTimeMillis())
    } else {
      // 시스템이 다시 살린 경우: 저장해 둔 설정으로 이어서 녹음
      cfgSession = prefs.getString("sessionId", null)
      cfgDir = prefs.getString("dir", null)
      cfgSite = prefs.getString("site", "") ?: ""
      cfgStarted = prefs.getLong("startedAt", System.currentTimeMillis())
      Log.w(TAG, "restarted by system, session=$cfgSession")
    }

    if (cfgSession == null || cfgDir == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    // 5초 안에 startForeground를 불러야 한다. 실패하면(백그라운드 시작 제한 등) 알림으로 알린다.
    try {
      val n = buildNotification("녹음 준비 중…", cfgSite, cfgStarted)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else {
        startForeground(NOTIF_ID, n)
      }
    } catch (e: Throwable) {
      Log.e(TAG, "startForeground failed", e)
      RecorderState.phase = "error"
      RecorderState.running = false
      RecorderState.lastError = "녹음 서비스를 시작하지 못했습니다: ${e.javaClass.simpleName}"
      postAlert("녹음이 멈췄습니다", "앱을 열어 '이어서 녹음'을 눌러 주세요.")
      stopSelf()
      return START_NOT_STICKY
    }

    prefs.edit()
      .putString("sessionId", cfgSession)
      .putString("dir", cfgDir)
      .putString("site", cfgSite)
      .putLong("startedAt", cfgStarted)
      .apply()

    handler.post { begin(cfgSession, cfgDir, cfgSite, cfgStarted) }
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // 최근 앱 목록에서 앱을 밀어도 녹음은 계속한다.
    Log.i(TAG, "task removed; recording continues")
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    try {
      handler.removeCallbacksAndMessages(null)
      stopChunk()
    } catch (e: Throwable) {
      Log.e(TAG, "onDestroy", e)
    }
    RecorderState.running = false
    if (RecorderState.phase != "error") RecorderState.phase = "stopped"
    releaseWakeLock()
    thread.quitSafely()
    super.onDestroy()
  }

  // ───────────────────────── 녹음 흐름 ─────────────────────────

  private fun begin(id: String, d: String, s: String, started: Long) {
    if (RecorderState.running && sessionId == id && recorder != null) {
      updateNotification(force = true)
      return
    }
    if (RecorderState.running && sessionId != id) {
      // 다른 점검이 돌고 있었다면 먼저 닫는다
      handler.removeCallbacks(rotateRunnable)
      stopChunk()
    }
    sessionId = id
    dir = d
    site = s
    startedAt = started
    inCall = false
    batteryAlerted15 = false
    batteryAlerted5 = false
    storageAlerted = false

    RecorderState.sessionId = id
    RecorderState.dir = d
    RecorderState.startedAt = started
    RecorderState.running = true
    RecorderState.lastError = null
    RecorderState.chunkCount = countChunks(d)

    acquireWakeLock()
    cancelAlert()
    startChunk()
    handler.removeCallbacks(watchdogRunnable)
    handler.postDelayed(watchdogRunnable, WATCHDOG_MS)
  }

  private fun startChunk() {
    handler.removeCallbacks(retryRunnable)
    retryScheduled = false
    handler.removeCallbacks(rotateRunnable)
    val d = dir ?: return
    if (!RecorderState.running) return

    val folder = File(d)
    if (!folder.exists()) folder.mkdirs()

    if (freeBytes(folder) < CRITICAL_STORAGE_BYTES) {
      RecorderState.phase = "error"
      RecorderState.lastError = "저장공간이 부족해 녹음을 멈췄습니다"
      postAlert("저장공간 부족", "저장공간이 거의 없어 녹음을 멈췄습니다. 공간을 비우고 앱에서 이어서 녹음하세요.")
      updateNotification(force = true)
      scheduleRetry(30_000L)
      return
    }

    val start = System.currentTimeMillis()
    val file = File(folder, "chunk_$start.aac")
    val r = newRecorder()
    try {
      r.setAudioSource(MediaRecorder.AudioSource.MIC)
      r.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS)
      r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      r.setAudioChannels(1)
      r.setAudioSamplingRate(44_100)
      r.setAudioEncodingBitRate(64_000)
      r.setOutputFile(file.absolutePath)
      r.setOnErrorListener { _, what, extra ->
        handler.post { onRecorderError("녹음기 오류($what/$extra)") }
      }
      r.prepare()
      r.start()
    } catch (e: Throwable) {
      Log.e(TAG, "start chunk failed", e)
      try { r.release() } catch (_: Throwable) {}
      if (file.exists() && file.length() == 0L) file.delete()
      RecorderState.phase = "retrying"
      RecorderState.lastError = "마이크를 열지 못했습니다. 다시 시도합니다."
      RecorderState.restarts++
      updateNotification(force = true)
      scheduleRetry(RETRY_MS)
      return
    }

    recorder = r
    currentFile = file
    lastSizeCheckBytes = -1L
    lastGrowthAt = System.currentTimeMillis()
    RecorderState.currentChunkPath = file.absolutePath
    RecorderState.currentChunkStartedAt = start
    RecorderState.chunkCount++
    RecorderState.phase = if (inCall) "interrupted" else "recording"
    RecorderState.lastError = null
    updateNotification(force = true)
    handler.postDelayed(rotateRunnable, CHUNK_MS)
  }

  @Suppress("DEPRECATION")
  private fun newRecorder(): MediaRecorder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(this) else MediaRecorder()

  private fun stopChunk() {
    val r = recorder ?: return
    recorder = null
    val f = currentFile
    currentFile = null
    try {
      r.stop()
    } catch (e: Throwable) {
      // 시작 직후 멈추면 데이터가 없어 예외가 난다. 빈 파일만 지운다.
      Log.w(TAG, "stop failed: ${e.message}")
      if (f != null && f.exists() && f.length() < 64) f.delete()
    }
    try { r.reset() } catch (_: Throwable) {}
    try { r.release() } catch (_: Throwable) {}
    RecorderState.currentChunkPath = null
  }

  private fun rotate(reason: String) {
    if (!RecorderState.running) return
    Log.i(TAG, "rotate: $reason")
    stopChunk()
    startChunk()
  }

  private fun onRecorderError(msg: String) {
    Log.e(TAG, msg)
    RecorderState.lastError = msg
    RecorderState.restarts++
    stopChunk()
    if (!RecorderState.running) return
    RecorderState.phase = "retrying"
    updateNotification(force = true)
    handler.removeCallbacks(rotateRunnable)
    scheduleRetry(RETRY_MS)
  }

  private fun shutdown() {
    handler.removeCallbacks(rotateRunnable)
    handler.removeCallbacks(retryRunnable)
    handler.removeCallbacks(watchdogRunnable)
    stopChunk()
    RecorderState.running = false
    RecorderState.phase = "stopped"
    getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    releaseWakeLock()
    cancelAlert()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
    stopSelf()
  }

  // ───────────────────────── 감시 ─────────────────────────

  private fun watchdog() {
    if (!RecorderState.running) return
    val now = System.currentTimeMillis()

    // 1) 통화 감지: 통화가 끝나면 새 파일로 다시 시작한다(일부 기기는 통화 뒤 무음만 녹음되는 문제가 있음).
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val mode = am.mode
    val callNow = mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION ||
      (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && mode == AudioManager.MODE_CALL_SCREENING)
    if (callNow && !inCall) {
      if (callCandidateSince == 0L) callCandidateSince = now
      if (now - callCandidateSince >= 1_000L) {
        inCall = true
        RecorderState.interruptions++
        RecorderState.phase = "interrupted"
        Log.i(TAG, "call started (mode=$mode)")
        updateNotification(force = true)
      }
    } else if (!callNow) {
      callCandidateSince = 0L
      if (inCall) {
        inCall = false
        Log.i(TAG, "call ended; restarting chunk")
        rotate("call-ended")
        if (recorder == null) scheduleRetry(RETRY_MS)
      }
    }

    // 2) 녹음 파일이 자라지 않으면(멈춘 녹음기) 다시 시작
    val f = currentFile
    if (recorder != null && f != null && !inCall) {
      val size = f.length()
      if (size != lastSizeCheckBytes) {
        lastSizeCheckBytes = size
        lastGrowthAt = now
      } else if (now - lastGrowthAt > STALL_MS) {
        Log.w(TAG, "recorder stalled; restarting")
        RecorderState.restarts++
        rotate("stalled")
      }
      RecorderState.lastBytes = size
    }

    // 3) 녹음기가 없는데 재시도 예약도 없으면 다시 시작
    if (recorder == null && !inCall && !retryScheduled && RecorderState.phase != "error") {
      scheduleRetry(RETRY_MS)
    }

    // 4) 저장공간·배터리 (20초마다)
    if (now - lastHealthCheckAt > 20_000L) {
      lastHealthCheckAt = now
      checkHealth()
    }
  }

  private fun checkHealth() {
    acquireWakeLock()
    val d = dir?.let { File(it) } ?: filesDir
    val free = freeBytes(d)
    RecorderState.lowStorage = free < LOW_STORAGE_BYTES
    if (RecorderState.lowStorage && !storageAlerted) {
      storageAlerted = true
      postAlert("저장공간 부족", "남은 공간이 ${free / (1024 * 1024)}MB입니다. 사진·동영상을 정리해 주세요.")
    }

    val bi = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    if (bi != null) {
      val level = bi.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
      val scale = bi.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
      val plugged = bi.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
      val pct = if (level >= 0 && scale > 0) level * 100 / scale else 100
      RecorderState.lowBattery = pct <= 15 && !plugged
      if (!plugged && pct <= 5 && !batteryAlerted5) {
        batteryAlerted5 = true
        postAlert("배터리 매우 부족 ($pct%)", "곧 꺼질 수 있습니다. 녹음은 1분마다 저장되고 있습니다. 충전기를 연결하세요.")
      } else if (!plugged && pct <= 15 && !batteryAlerted15) {
        batteryAlerted15 = true
        postAlert("배터리 부족 ($pct%)", "점검 녹음 중입니다. 충전기를 연결하세요.")
      }
    }
    updateNotification(force = false)
  }

  // ───────────────────────── 알림 ─────────────────────────

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val ch = NotificationChannel(CHANNEL_ID, "점검 녹음", NotificationManager.IMPORTANCE_LOW).apply {
      description = "녹음 중임을 표시합니다"
      setShowBadge(false)
    }
    val alert = NotificationChannel(ALERT_CHANNEL_ID, "점검 경고", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "녹음 중단, 저장공간·배터리 부족 경고"
    }
    nm.createNotificationChannel(ch)
    nm.createNotificationChannel(alert)
  }

  private fun contentIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    return PendingIntent.getActivity(
      this, 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun buildNotification(text: String, siteName: String, since: Long): Notification {
    val title = if (siteName.isNotBlank()) "점검 녹음 중 · $siteName" else "점검 녹음 중"
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setShowWhen(true)
      .setWhen(since)
      .setUsesChronometer(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setContentIntent(contentIntent())
      .build()
  }

  private fun updateNotification(force: Boolean) {
    val parts = mutableListOf<String>()
    parts += when (RecorderState.phase) {
      "recording" -> "1분마다 자동 저장 중 (${RecorderState.chunkCount}개)"
      "interrupted" -> "통화 중 — 통화가 끝나면 자동으로 이어서 녹음"
      "retrying" -> "녹음 다시 시작 중…"
      "error" -> RecorderState.lastError ?: "녹음 오류"
      else -> "녹음 준비 중…"
    }
    if (RecorderState.lowStorage) parts += "⚠ 저장공간 부족"
    if (RecorderState.lowBattery) parts += "⚠ 배터리 부족"
    val text = parts.joinToString(" · ")
    if (!force && text == lastNotifText) return
    lastNotifText = text
    try {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(NOTIF_ID, buildNotification(text, site, startedAt))
    } catch (e: Throwable) {
      Log.w(TAG, "notify failed", e)
    }
  }

  private fun postAlert(title: String, text: String) {
    try {
      val n = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(text)
        .setStyle(NotificationCompat.BigTextStyle().bigText(text))
        .setSmallIcon(android.R.drawable.stat_sys_warning)
        .setAutoCancel(true)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(contentIntent())
        .build()
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(ALERT_NOTIF_ID, n)
    } catch (e: Throwable) {
      Log.w(TAG, "alert failed", e)
    }
  }

  private fun cancelAlert() {
    try {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ALERT_NOTIF_ID)
    } catch (_: Throwable) {}
  }

  // ───────────────────────── 기타 ─────────────────────────

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FieldRecorder:recording").apply {
      setReferenceCounted(false)
      // 최대 12시간. 점검이 그보다 길면 서비스가 다시 잡는다.
      acquire(12L * 60 * 60 * 1000)
    }
  }

  private fun releaseWakeLock() {
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Throwable) {}
    wakeLock = null
  }

  private fun countChunks(d: String): Int =
    File(d).listFiles()?.count { it.name.startsWith("chunk_") && it.name.endsWith(".aac") } ?: 0

  private fun freeBytes(f: File): Long = try {
    StatFs(if (f.exists()) f.path else filesDir.path).availableBytes
  } catch (_: Throwable) {
    Long.MAX_VALUE
  }
}

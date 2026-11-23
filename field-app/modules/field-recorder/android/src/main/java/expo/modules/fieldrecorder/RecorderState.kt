package expo.modules.fieldrecorder

/**
 * 녹음 서비스와 JS 모듈이 함께 보는 상태. 같은 프로세스 안에서만 공유된다.
 */
object RecorderState {
  /** recording | interrupted | retrying | stopped | error */
  @Volatile var phase: String = "stopped"
  @Volatile var running: Boolean = false
  @Volatile var sessionId: String? = null
  @Volatile var dir: String? = null
  @Volatile var startedAt: Long = 0L
  @Volatile var currentChunkPath: String? = null
  @Volatile var currentChunkStartedAt: Long = 0L
  @Volatile var chunkCount: Int = 0
  @Volatile var restarts: Int = 0
  @Volatile var interruptions: Int = 0
  @Volatile var lastError: String? = null
  @Volatile var lowStorage: Boolean = false
  @Volatile var lowBattery: Boolean = false
  @Volatile var lastBytes: Long = 0L

  fun toMap(): Map<String, Any?> = mapOf(
    "phase" to phase,
    "running" to running,
    "sessionId" to sessionId,
    "dir" to dir,
    "startedAt" to startedAt.toDouble(),
    "currentChunkPath" to currentChunkPath,
    "currentChunkStartedAt" to currentChunkStartedAt.toDouble(),
    "chunkCount" to chunkCount,
    "restarts" to restarts,
    "interruptions" to interruptions,
    "lastError" to lastError,
    "lowStorage" to lowStorage,
    "lowBattery" to lowBattery,
  )
}

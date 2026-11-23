package expo.modules.fieldrecorder

import android.view.KeyEvent

/**
 * MainActivity.dispatchKeyEvent에서 불린다(plugins/withVolumeKeys.js가 코드를 넣음).
 * 촬영 화면에서만 켜서 볼륨 버튼을 셔터로 쓴다. 꺼져 있으면 볼륨은 원래대로 동작한다.
 */
object VolumeKeyBridge {
  @Volatile var enabled: Boolean = false
  @Volatile var listener: ((String) -> Unit)? = null

  @JvmStatic
  fun handle(event: KeyEvent): Boolean {
    if (!enabled) return false
    val code = event.keyCode
    if (code != KeyEvent.KEYCODE_VOLUME_UP && code != KeyEvent.KEYCODE_VOLUME_DOWN) return false
    if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
      try {
        listener?.invoke(if (code == KeyEvent.KEYCODE_VOLUME_UP) "up" else "down")
      } catch (_: Throwable) {}
    }
    return true
  }
}

// MainActivity에 볼륨 버튼 가로채기 코드를 넣는다. (촬영 화면에서만 켜짐)
const { withMainActivity } = require('expo/config-plugins');

const MARKER = '// FieldRecorderVolumeKeys';

module.exports = function withVolumeKeys(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withVolumeKeys: MainActivity must be Kotlin');
    }
    let src = cfg.modResults.contents;
    if (!src.includes(MARKER)) {
      const re = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
      if (!re.test(src)) throw new Error('withVolumeKeys: could not find MainActivity class');
      src = src.replace(
        re,
        (m) =>
          `${m}\n  ${MARKER}\n  override fun dispatchKeyEvent(event: android.view.KeyEvent): Boolean {\n    if (expo.modules.fieldrecorder.VolumeKeyBridge.handle(event)) return true\n    return super.dispatchKeyEvent(event)\n  }\n`
      );
    }
    cfg.modResults.contents = src;
    return cfg;
  });
};

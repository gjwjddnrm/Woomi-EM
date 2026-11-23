import { Alert } from 'react-native';
import * as DB from './db';
import { finishInspection, isRecordingFor, startRecording } from './inspection';
import type { Nav } from './nav';
import { errMsg, fmtClock } from './util';

/**
 * 진행 중이던 점검을 이어간다.
 * - 녹음이 아직 돌고 있으면 바로 촬영 화면으로
 * - 멈춰 있으면 "이어서 녹음할까요?"를 묻는다
 */
export function resumeInspectionFlow(insp: DB.Inspection, nav: Nav, mode: 'push' | 'reset' = 'push'): void {
  const go = (r: Parameters<Nav['push']>[0]) => (mode === 'reset' ? nav.reset(r) : nav.push(r));
  if (isRecordingFor(insp.id)) {
    go({ name: 'capture', id: insp.id });
    return;
  }
  const photos = DB.countPhotos(insp.id);
  Alert.alert(
    '진행 중이던 점검이 있습니다',
    `${insp.site}\n${fmtClock(insp.started_at)} 시작 · 사진 ${photos}장\n\n녹음이 멈춰 있습니다. 이어서 녹음할까요?\n(지금까지 녹음은 1분 단위로 저장되어 있습니다)`,
    [
      {
        text: '점검 끝내기',
        style: 'destructive',
        onPress: async () => {
          await finishInspection(insp).catch(() => {});
          go({ name: 'timeline', id: insp.id });
        },
      },
      {
        text: '이어서 녹음',
        onPress: async () => {
          try {
            await startRecording(insp);
            go({ name: 'capture', id: insp.id });
          } catch (e) {
            Alert.alert('녹음을 시작하지 못했습니다', errMsg(e));
            go({ name: 'capture', id: insp.id });
          }
        },
      },
    ],
    { cancelable: false }
  );
}

import { CameraView, useCameraPermissions } from 'expo-camera';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  AppState,
  BackHandler,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import FieldRecorder, { type RecorderStatus } from '../../modules/field-recorder';
import * as DB from '../db';
import { Banner, BigButton } from '../components/ui';
import { finishInspection, getHealth, getStatus, healthWarnings, startRecording } from '../inspection';
import { useNav } from '../nav';
import { savePhotoNow } from '../storage';
import { C } from '../theme';
import { errMsg, fmtDuration } from '../util';

export default function CaptureScreen({ id }: { id: string }) {
  const nav = useNav();
  const [insp] = useState(() => DB.getInspection(id));
  const [perm, requestPerm] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [camKey, setCamKey] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState<RecorderStatus | null>(getStatus());
  const [warns, setWarns] = useState<string[]>(healthWarnings(getHealth()));
  const [count, setCount] = useState(() => DB.countPhotos(id));
  const [last, setLast] = useState<DB.Photo | null>(() => DB.lastPhoto(id));
  const [capturing, setCapturing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [memoFor, setMemoFor] = useState<DB.Photo | null>(null);
  const [memoText, setMemoText] = useState('');
  const [ending, setEnding] = useState(false);
  const capturingRef = useRef(false);
  const lastRestartRef = useRef(0);
  const endingRef = useRef(false);

  // 카메라 권한
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) requestPerm();
  }, [perm, requestPerm]);

  // 앱 전환 감지
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  // 1초마다 녹음 상태 확인, 멈췄으면 자동으로 다시 시작
  useEffect(() => {
    if (!insp) return;
    const tick = () => {
      setNow(Date.now());
      const s = getStatus();
      setStatus(s);
      const ok = s && s.running && s.sessionId === insp.id;
      if (!ok && !endingRef.current && AppState.currentState === 'active' && Date.now() - lastRestartRef.current > 10_000) {
        lastRestartRef.current = Date.now();
        startRecording(insp).catch((e) => console.warn('auto restart', e));
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [insp]);

  // 30초마다 저장공간·배터리 확인
  useEffect(() => {
    const t = setInterval(() => setWarns(healthWarnings(getHealth())), 30_000);
    return () => clearInterval(t);
  }, []);

  const shoot = useCallback(async () => {
    if (!insp || capturingRef.current || !camRef.current || endingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    const takenAt = Date.now();
    try {
      const pic = await camRef.current.takePictureAsync({
        quality: 0.85,
        exif: false,
        // 촬영음: 설정에서 켜야만 남 (기본 끔 — 녹음에 찰칵 소리가 섞이지 않게)
        shutterSound: DB.getSetting('shutterSound') === '1',
      });
      if (!pic?.uri) throw new Error('사진 파일이 없습니다');
      const p = savePhotoNow(insp, pic.uri, takenAt, { width: pic.width, height: pic.height });
      Vibration.vibrate(60);
      setLast(p);
      setCount((c) => c + 1);
      setSaveError(null);
    } catch (e) {
      Vibration.vibrate([0, 80, 80, 80]);
      setSaveError(`사진 저장 실패: ${errMsg(e)}`);
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  }, [insp]);

  // 볼륨 버튼 셔터 (이 화면이 앞에 있을 때만)
  const volumeEnabled = appActive && !memoFor && !ending;
  useEffect(() => {
    try {
      FieldRecorder.setVolumeKeyCapture(volumeEnabled);
    } catch {}
    const sub = FieldRecorder.addListener('onVolumeKey', () => {
      shoot();
    });
    return () => {
      sub.remove();
      try {
        FieldRecorder.setVolumeKeyCapture(false);
      } catch {}
    };
  }, [volumeEnabled, shoot]);

  const endInspection = useCallback(() => {
    if (!insp) return;
    Alert.alert('점검을 종료할까요?', `사진 ${count}장. 녹음을 멈추고 타임라인을 만듭니다.`, [
      { text: '계속 점검', style: 'cancel' },
      {
        text: '점검 종료',
        style: 'destructive',
        onPress: async () => {
          endingRef.current = true;
          setEnding(true);
          try {
            await finishInspection(insp);
          } catch (e) {
            Alert.alert('종료 중 오류', errMsg(e));
          }
          nav.reset({ name: 'timeline', id: insp.id });
        },
      },
    ]);
  }, [insp, count, nav]);

  // 뒤로 버튼: 실수로 나가지 않도록
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (memoFor) {
        setMemoFor(null);
        return true;
      }
      Alert.alert('점검 중입니다', '녹음은 계속됩니다. 어떻게 할까요?', [
        { text: '계속 촬영', style: 'cancel' },
        { text: '홈으로 (녹음 계속)', onPress: () => nav.reset({ name: 'home' }) },
        { text: '점검 종료', style: 'destructive', onPress: endInspection },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [memoFor, nav, endInspection]);

  if (!insp) {
    return (
      <View style={[styles.root, { justifyContent: 'center', padding: 20 }]}>
        <Text style={styles.msg}>점검 기록을 찾을 수 없습니다.</Text>
        <BigButton title="홈으로" onPress={() => nav.reset({ name: 'home' })} />
      </View>
    );
  }

  const recOk = !!status && status.running && status.sessionId === insp.id;
  const phase = recOk ? status!.phase : 'stopped';
  const dotColor = phase === 'recording' ? C.red : phase === 'stopped' || phase === 'error' ? '#777' : C.yellow;
  const blink = phase === 'recording' && Math.floor(now / 700) % 2 === 0;
  const recLabel =
    phase === 'recording'
      ? '녹음 중'
      : phase === 'interrupted'
        ? '통화 중'
        : phase === 'retrying'
          ? '재연결 중'
          : '녹음 멈춤';

  const openMemo = (p: DB.Photo) => {
    setMemoText(p.memo ?? '');
    setMemoFor(p);
  };
  const saveMemo = () => {
    if (memoFor) {
      DB.setPhotoMemo(memoFor.id, memoText);
      if (last && last.id === memoFor.id) setLast({ ...last, memo: memoText.trim() || null });
    }
    setMemoFor(null);
  };

  return (
    <View style={styles.root}>
      {/* 녹음 상태: 항상 표시 */}
      <View style={styles.statusBar}>
        <View style={[styles.dot, { backgroundColor: dotColor, opacity: blink ? 0.35 : 1 }]} />
        <Text style={styles.recLabel}>{recLabel}</Text>
        <Text style={styles.elapsed}>{fmtDuration(now - insp.started_at)}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.count}>사진 {count}</Text>
      </View>
      <Text style={styles.site} numberOfLines={1}>
        {insp.site}
      </Text>

      <View style={styles.banners}>
        {!recOk && !ending ? <Banner kind="error" text="녹음이 멈췄습니다. 다시 시작하는 중…" /> : null}
        {recOk && phase === 'interrupted' ? (
          <Banner text="통화 중 — 통화가 끝나면 자동으로 이어서 녹음합니다" />
        ) : null}
        {recOk && phase === 'retrying' ? <Banner text="마이크 다시 연결 중…" /> : null}
        {status?.lowStorage ? <Banner kind="error" text="저장공간 부족!" /> : null}
        {warns.map((w) => (
          <Banner key={w} text={w} />
        ))}
        {saveError ? <Banner kind="error" text={saveError} /> : null}
        {camError ? (
          <Banner
            kind="error"
            text={`카메라 오류: ${camError}`}
            action="다시"
            onAction={() => {
              setCamError(null);
              setCamKey((k) => k + 1);
            }}
          />
        ) : null}
      </View>

      <View style={styles.cameraWrap}>
        {perm?.granted ? (
          <CameraView
            key={camKey}
            ref={camRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            active={appActive && !ending}
            animateShutter
            onMountError={(e) => setCamError(e.message)}
          />
        ) : (
          <View style={styles.noCam}>
            <Text style={styles.msg}>카메라 권한이 필요합니다</Text>
            <BigButton
              title="권한 허용"
              onPress={() => (perm?.canAskAgain ? requestPerm() : FieldRecorder.openAppSettings())}
            />
          </View>
        )}
        <Text style={styles.hint}>볼륨 버튼으로도 촬영</Text>
      </View>

      {/* 한 손 조작: 아래쪽에 큰 버튼 */}
      <View style={styles.bottom}>
        <Pressable style={styles.thumbBox} onPress={() => last && openMemo(last)} disabled={!last}>
          {last ? (
            <>
              <Image source={{ uri: last.uri }} style={styles.thumb} />
              <Text style={styles.thumbLabel} numberOfLines={1}>
                {last.memo ? '✎ 메모됨' : '+ 메모'}
              </Text>
            </>
          ) : (
            <Text style={styles.thumbEmpty}>사진 없음</Text>
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="촬영"
          onPress={shoot}
          disabled={!perm?.granted || ending}
          style={({ pressed }) => [styles.shutter, (pressed || capturing) && { transform: [{ scale: 0.92 }] }]}
        >
          <View style={[styles.shutterInner, capturing && { backgroundColor: C.yellow }]} />
        </Pressable>

        <Pressable style={styles.endBtn} onPress={endInspection} disabled={ending}>
          <Text style={styles.endText}>{ending ? '종료 중' : '점검\n종료'}</Text>
        </Pressable>
      </View>

      <Modal visible={!!memoFor} transparent animationType="fade" onRequestClose={() => setMemoFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>사진 메모 (한 줄)</Text>
            <TextInput
              value={memoText}
              onChangeText={setMemoText}
              autoFocus
              placeholder="예: 소화기 압력 미달"
              placeholderTextColor="#777"
              style={styles.memoInput}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveMemo}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <BigButton title="취소" kind="dark" onPress={() => setMemoFor(null)} style={{ flex: 1 }} />
              <BigButton title="저장" onPress={saveMemo} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },
  dot: { width: 22, height: 22, borderRadius: 11 },
  recLabel: { color: C.text, fontSize: 22, fontWeight: '900' },
  elapsed: { color: C.text, fontSize: 30, fontWeight: '900', fontVariant: ['tabular-nums'] },
  count: { color: C.yellow, fontSize: 24, fontWeight: '900' },
  site: { color: C.sub, fontSize: 17, fontWeight: '700', paddingHorizontal: 14, paddingBottom: 6 },
  banners: { paddingHorizontal: 10 },
  cameraWrap: { flex: 1, backgroundColor: '#111', overflow: 'hidden' },
  noCam: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, gap: 16 },
  hint: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    color: C.text,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 15,
    fontWeight: '700',
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  thumbBox: {
    width: 84,
    height: 96,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: { width: '100%', height: 70 },
  thumbLabel: { color: C.yellow, fontSize: 14, fontWeight: '800', paddingVertical: 3 },
  thumbEmpty: { color: '#777', fontSize: 14, textAlign: 'center' },
  shutter: {
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 6,
    borderColor: C.text,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.text },
  endBtn: {
    width: 84,
    height: 96,
    borderRadius: 10,
    backgroundColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endText: { color: C.text, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  msg: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 16 },
  modal: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 2, borderColor: C.cardBorder },
  modalTitle: { color: C.text, fontSize: 22, fontWeight: '900', marginBottom: 12 },
  memoInput: {
    backgroundColor: '#fff',
    color: '#000',
    fontSize: 22,
    fontWeight: '700',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});

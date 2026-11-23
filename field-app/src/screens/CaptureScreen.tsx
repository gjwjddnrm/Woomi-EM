import { CameraView, useCameraPermissions } from '../camera';

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
import { Banner, BigButton, Icon, ui } from '../components/ui';
import { finishInspection, getHealth, getStatus, healthWarnings, startRecording } from '../inspection';
import { useNav } from '../nav';
import { savePhotoNow } from '../storage';
import { C, F, T } from '../theme';
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
    const t = setInterval(tick, 400);
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
  const dotColor = phase === 'recording' ? C.red : phase === 'stopped' || phase === 'error' ? '#777' : C.amber;
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
      {/* 카메라: 화면을 꽉 채움 */}
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
            <Icon name="camera-off-outline" size={48} color={'#6F7C8F'} />
            <Text style={styles.msg}>카메라 권한이 필요합니다</Text>
            <BigButton
              title="권한 허용"
              icon="camera"
              onPress={() => (perm?.canAskAgain ? requestPerm() : FieldRecorder.openAppSettings())}
            />
          </View>
        )}

        {/* 위쪽 상태 표시 (항상 보임) */}
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.topRow}>
            <View style={[styles.recCapsule, { borderColor: dotColor }]}>
              <View style={[styles.dot, { backgroundColor: dotColor, opacity: blink ? 0.3 : 1 }]} />
              <Text style={[styles.recLabel, { color: dotColor === C.red ? '#FF8A82' : dotColor }]}>
                {phase === 'recording' ? 'REC' : recLabel}
              </Text>
              <Text style={styles.elapsed}>{fmtDuration(now - insp.started_at)}</Text>
            </View>
            <View style={{ flex: 1 }} />
            {recOk && phase === 'recording' ? (
              <View style={[styles.voiceCapsule, status?.voice && styles.voiceOn]}>
                <View style={styles.bars}>
                  {[0.25, 0.5, 0.75, 1].map((k) => (
                    <View
                      key={k}
                      style={[
                        styles.bar,
                        { height: 6 + k * 14, backgroundColor: (status?.level ?? 0) >= k * 0.8 ? (status?.voice ? '#4ADE80' : C.camSub) : 'rgba(255,255,255,0.18)' },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.voiceText, status?.voice && { color: '#4ADE80' }]}>{status?.voice ? '말소리' : '조용'}</Text>
              </View>
            ) : null}
            <View style={styles.countCapsule}>
              <Icon name="camera" size={18} color={C.amber} />
              <Text style={styles.count}>{count}</Text>
            </View>
          </View>
          <View style={styles.siteCapsule}>
            <Icon name="map-marker" size={16} color={C.camSub} />
            <Text style={styles.site} numberOfLines={1}>
              {insp.site}
            </Text>
          </View>

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
        </View>

        <View style={styles.hint} pointerEvents="none">
          <Icon name="volume-high" size={15} color={C.camSub} />
          <Text style={styles.hintText}>볼륨 버튼으로도 촬영</Text>
        </View>
      </View>

      {/* 아래 조작부: 한 손으로 */}
      <View style={styles.bottom}>
        <Pressable style={styles.thumbBox} onPress={() => last && openMemo(last)} disabled={!last}>
          {last ? (
            <>
              <Image source={{ uri: last.uri }} style={styles.thumb} />
              <View style={styles.thumbTag}>
                <Icon name={last.memo ? 'note-check-outline' : 'pencil-plus-outline'} size={14} color="#1A1200" />
                <Text style={styles.thumbTagText}>{last.memo ? '메모됨' : '메모'}</Text>
              </View>
            </>
          ) : (
            <Icon name="image-outline" size={30} color={'#6F7C8F'} />
          )}
        </Pressable>

        <Pressable
          accessibilityLabel="촬영"
          onPress={shoot}
          disabled={!perm?.granted || ending}
          style={({ pressed }) => [styles.shutter, (pressed || capturing) && { transform: [{ scale: 0.93 }] }]}
        >
          <View style={[styles.shutterInner, capturing && { backgroundColor: C.amber }]}>
            <Icon name="camera" size={38} color={capturing ? '#1A1200' : '#111'} />
          </View>
        </Pressable>

        <Pressable style={styles.endBtn} onPress={endInspection} disabled={ending}>
          <Icon name={ending ? 'progress-clock' : 'stop'} size={30} color={C.white} />
          <Text style={styles.endText}>{ending ? '종료 중' : '종료'}</Text>
        </Pressable>
      </View>

      <Modal visible={!!memoFor} transparent animationType="fade" onRequestClose={() => setMemoFor(null)}>
        <View style={ui.modalBg}>
          <View style={ui.modal}>
            <Text style={ui.modalTitle}>사진 메모</Text>
            {memoFor ? <Image source={{ uri: memoFor.uri }} style={styles.memoPhoto} /> : null}
            <TextInput
              value={memoText}
              onChangeText={setMemoText}
              autoFocus
              placeholder="예: 소화기 압력 미달"
              placeholderTextColor={'#6F7C8F'}
              style={ui.input}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={saveMemo}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <BigButton title="취소" kind="dark" onPress={() => setMemoFor(null)} style={{ flex: 1 }} />
              <BigButton title="저장" icon="check" onPress={saveMemo} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const overlay = 'rgba(11,14,19,0.78)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.camBg },
  cameraWrap: { flex: 1, backgroundColor: '#05070A', overflow: 'hidden' },
  noCam: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, padding: 12, gap: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  recCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: overlay,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 8,
  },
  dot: { width: 16, height: 16, borderRadius: 8 },
  recLabel: { fontSize: 16, fontFamily: F.xbold, letterSpacing: 1 },
  elapsed: { color: C.white, fontSize: 28, fontFamily: F.xbold, ...T.num, letterSpacing: -0.5 },
  voiceCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: overlay,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  voiceOn: { borderColor: '#4ADE80' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 20 },
  bar: { width: 4, borderRadius: 2 },
  voiceText: { color: C.camSub, fontFamily: F.bold, fontSize: 13 },
  countCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: overlay,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  count: { color: C.white, fontSize: 22, fontFamily: F.xbold, ...T.num },
  siteCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: overlay,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  site: { color: C.camText, fontSize: 15, fontFamily: F.bold, flexShrink: 1 },
  banners: { marginTop: 2 },
  hint: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hintText: { color: C.camSub, fontSize: 14, fontFamily: F.bold },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    backgroundColor: C.camPanel,
    borderTopWidth: 1,
    borderTopColor: C.camLine,
  },
  thumbBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.camLine,
    backgroundColor: '#1D2430',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: { width: '100%', height: '100%' },
  thumbTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.amber,
    paddingVertical: 3,
  },
  thumbTagText: { color: '#1A1200', fontSize: 12, fontFamily: F.xbold },
  shutter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 5,
    borderColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: C.red,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  endText: { color: C.white, fontSize: 15, fontFamily: F.xbold },
  msg: { color: C.camText, fontSize: 19, fontFamily: F.bold, textAlign: 'center' },
  memoPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, marginBottom: 14, backgroundColor: '#1D2430' },
});

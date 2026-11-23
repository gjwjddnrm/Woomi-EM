import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { Chunk } from '../../modules/field-recorder';
import * as DB from '../db';
import { BigButton, Card, Header, Icon, IconButton, Pill, SectionLabel, Stat, ui } from '../components/ui';
import { useNav } from '../nav';
import { deleteInspectionFiles, listChunks, makeClip, totalRecordedMs } from '../storage';
import { C, F, S, T } from '../theme';
import { errMsg, fmtClock, fmtDate, fmtDuration, toFileUri } from '../util';
import { photoContext } from '../transcribe';
import { exportPhotosZip, savePhotosToGallery, sharePhoto } from '../export';

type Playing = { key: string; clipStart: number; center: number } | null;

export default function TimelineScreen({ id }: { id: string }) {
  const nav = useNav();
  const [insp] = useState(() => DB.getInspection(id));
  const [photos, setPhotos] = useState<DB.Photo[]>(() => DB.listPhotos(id));
  const [chunks, setChunks] = useState<Chunk[] | null>(null);
  const [transcripts, setTranscripts] = useState<DB.Transcript[]>(() => DB.listTranscripts(id));
  const [playing, setPlaying] = useState<Playing>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [viewer, setViewer] = useState<DB.Photo | null>(null);
  const [memoFor, setMemoFor] = useState<DB.Photo | null>(null);
  const [memoText, setMemoText] = useState('');
  const [showChunks, setShowChunks] = useState(false);

  const player = useAudioPlayer(null, { updateInterval: 250 });
  const st = useAudioPlayerStatus(player);

  const reload = useCallback(() => {
    if (!insp) return;
    setPhotos(DB.listPhotos(insp.id));
    setTranscripts(DB.listTranscripts(insp.id));
    listChunks(insp).then(setChunks);
  }, [insp]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      nav.reset({ name: 'home' });
      return true;
    });
    return () => sub.remove();
  }, [nav]);

  useEffect(() => {
    if (st.didJustFinish) setPlaying(null);
  }, [st.didJustFinish]);

  const stop = useCallback(() => {
    try {
      player.pause();
    } catch {}
    setPlaying(null);
  }, [player]);

  const playAround = useCallback(
    async (key: string, center: number, before = 30_000, after = 30_000) => {
      if (!insp || !chunks) return;
      if (playing?.key === key) {
        stop();
        return;
      }
      setLoadingKey(key);
      try {
        const clip = await makeClip(insp, chunks, center, before, after);
        if (!clip) {
          Alert.alert('녹음 없음', '이 시점에는 녹음된 소리가 없습니다. (통화 중이었거나 녹음이 멈춰 있었을 수 있습니다)');
          return;
        }
        player.replace({ uri: toFileUri(clip.path) });
        player.play();
        setPlaying({ key, clipStart: clip.startMs, center });
      } catch (e) {
        Alert.alert('재생 오류', errMsg(e));
      } finally {
        setLoadingKey(null);
      }
    },
    [insp, chunks, player, playing, stop]
  );

  const totalMs = useMemo(() => (chunks ? totalRecordedMs(chunks) : 0), [chunks]);

  if (!insp) {
    return (
      <View style={[styles.root, { padding: 20, justifyContent: 'center' }]}>
        <Text style={styles.text}>점검 기록을 찾을 수 없습니다.</Text>
        <BigButton title="홈으로" onPress={() => nav.reset({ name: 'home' })} />
      </View>
    );
  }

  const onDelete = () => {
    Alert.alert('이 점검을 삭제할까요?', '사진과 녹음이 모두 지워지고 되돌릴 수 없습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          stop();
          deleteInspectionFiles(insp);
          DB.deleteInspectionRows(insp.id);
          nav.reset({ name: 'home' });
        },
      },
    ]);
  };

  const saveMemo = () => {
    if (memoFor) {
      DB.setPhotoMemo(memoFor.id, memoText);
      setPhotos(DB.listPhotos(insp.id));
    }
    setMemoFor(null);
  };

  const renderPlayer = (key: string) => {
    if (playing?.key !== key) return null;
    const cur = st.currentTime || 0;
    const dur = st.duration || 0;
    const pct = dur > 0 ? Math.min(1, cur / dur) : 0;
    const centerSec = (playing.center - playing.clipStart) / 1000;
    const centerPct = dur > 0 ? Math.min(1, Math.max(0, centerSec / dur)) : 0.5;
    return (
      <View style={styles.playerBox}>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
          <View style={[styles.centerMark, { left: `${centerPct * 100}%` }]} />
        </View>
        <View style={styles.playerTimeRow}>
          <Text style={styles.playerTime}>{fmtClock(playing.clipStart + cur * 1000)}</Text>
          <Text style={styles.playerTimeSub}>
            {fmtDuration(cur * 1000)} / {fmtDuration(dur * 1000)}
          </Text>
        </View>
        <View style={styles.playerRow}>
          <Pressable style={styles.pBtn} onPress={() => player.seekTo(Math.max(0, cur - 10))}>
            <Icon name="rewind-10" size={28} />
          </Pressable>
          <Pressable style={[styles.pBtn, styles.pBtnMain]} onPress={() => (st.playing ? player.pause() : player.play())}>
            <Icon name={st.playing ? 'pause' : 'play'} size={32} color="#1A1200" />
          </Pressable>
          <Pressable style={styles.pBtn} onPress={() => player.seekTo(Math.min(dur, cur + 10))}>
            <Icon name="fast-forward-10" size={28} />
          </Pressable>
          <Pressable style={styles.pBtn} onPress={stop}>
            <Icon name="stop" size={28} />
          </Pressable>
        </View>
      </View>
    );
  };

  const header = (
    <View style={{ padding: S.pad }}>
      <Text style={styles.site}>{insp.site}</Text>
      <Text style={styles.meta}>
        {fmtDate(insp.started_at)} · {fmtClock(insp.started_at)}
        {insp.ended_at ? ` ~ ${fmtClock(insp.ended_at)}` : ' (진행 중)'}
      </Text>
      <View style={styles.stats}>
        <Stat icon="camera-outline" label="사진" value={`${photos.length}장`} />
        <Stat icon="microphone-outline" label="녹음" value={chunks ? fmtDuration(totalMs) : '…'} />
        <Stat
          icon="text-box-check-outline"
          label="텍스트 변환"
          value={chunks ? `${transcripts.length}/${chunks.filter((c) => !c.active).length}` : '…'}
          tone={chunks && chunks.length > 0 && transcripts.length >= chunks.filter((c) => !c.active).length ? 'ok' : undefined}
        />
      </View>

      {insp.status === 'ended' ? (
        <BigButton
          title="정리하기"
          sub="텍스트 변환 · 보고서 초안 · PDF 공유"
          icon="file-document-edit-outline"
          onPress={() => {
            stop();
            nav.push({ name: 'report', id: insp.id });
          }}
          style={{ marginTop: 14 }}
        />
      ) : null}

      <Pressable onPress={() => setShowChunks((v) => !v)} style={styles.chunkToggle}>
        <Icon name={showChunks ? 'chevron-down' : 'chevron-right'} size={22} color={C.sub} />
        <Text style={styles.chunkToggleText}>녹음 파일 {chunks ? `${chunks.length}개` : ''}</Text>
      </Pressable>
      {showChunks && chunks ? (
        <Card style={{ paddingVertical: 4 }}>
          {chunks.map((c, i) => {
            const key = `chunk_${c.startMs}`;
            return (
              <View key={key}>
                <Pressable
                  style={[styles.chunkRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}
                  onPress={() => playAround(key, c.startMs + c.durationMs / 2, c.durationMs / 2 + 1000, c.durationMs / 2 + 1000)}
                >
                  <Icon
                    name={playing?.key === key ? 'stop-circle' : loadingKey === key ? 'progress-clock' : 'play-circle-outline'}
                    size={28}
                    color={C.primary}
                  />
                  <Text style={styles.chunkText}>{fmtClock(c.startMs)}</Text>
                  {c.speechMs === 0 ? (
                    <Pill text="무음" />
                  ) : c.speechMs > 0 ? (
                    <Pill icon="account-voice" text={`말소리 ${fmtDuration(c.speechMs)}`} color={C.green} bg={C.greenSoft} />
                  ) : null}
                  <Text style={styles.chunkDur}>{fmtDuration(c.durationMs)}</Text>
                </Pressable>
                {renderPlayer(key)}
              </View>
            );
          })}
        </Card>
      ) : null}
      <SectionLabel text="시간순 타임라인" style={{ marginTop: 22, marginBottom: 4 }} />
      {photos.length === 0 ? <Text style={styles.empty}>사진이 없습니다.</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Header
        title="점검 타임라인"
        onBack={() => {
          stop();
          nav.reset({ name: 'home' });
        }}
        right={
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              icon="export-variant"
              dark
              onPress={() =>
                Alert.alert('사진 내보내기', '다른 보고서 양식에 쓸 사진을 내보냅니다.', [
                  { text: '취소', style: 'cancel' },
                  { text: '갤러리에 모두 저장', onPress: () => savePhotosToGallery(insp).then((n) => Alert.alert('저장했습니다', `${n}장 · 갤러리 › 앨범 › 현장점검`)).catch((e) => Alert.alert('저장 실패', errMsg(e))) },
                  { text: 'ZIP으로 보내기', onPress: () => exportPhotosZip(insp).catch((e) => Alert.alert('내보내기 실패', errMsg(e))) },
                ])
              }
            />
            <IconButton icon="trash-can-outline" color="#FF8A82" onPress={onDelete} />
          </View>
        }
      />
      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 60 }}
        renderItem={({ item, index }) => {
          const key = `photo_${item.id}`;
          const ctx = transcripts.length ? photoContext(transcripts, item.taken_at) : null;
          const isLast = index === photos.length - 1;
          return (
            <View style={styles.tlRow}>
              {/* 시간선 */}
              <View style={styles.rail}>
                <View style={styles.railNum}>
                  <Text style={styles.railNumText}>{index + 1}</Text>
                </View>
                {!isLast ? <View style={styles.railLine} /> : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTime}>{fmtClock(item.taken_at)}</Text>
                  <Pill text={`+${fmtDuration(item.offset_ms)}`} />
                </View>
                <Pressable onPress={() => setViewer(item)}>
                  <Image source={{ uri: item.uri }} style={styles.photo} resizeMode="cover" />
                  <View style={styles.zoom}>
                    <Icon name="arrow-expand" size={18} color={C.white} />
                  </View>
                </Pressable>
                <Pressable
                  style={styles.memoRow}
                  onPress={() => {
                    setMemoText(item.memo ?? '');
                    setMemoFor(item);
                  }}
                >
                  <Icon name={item.memo ? 'note-text-outline' : 'pencil-plus-outline'} size={20} color={item.memo ? C.primary : C.faint} />
                  <Text style={item.memo ? styles.memo : styles.memoEmpty}>{item.memo ?? '메모 추가'}</Text>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => sharePhoto(item).catch((e) => Alert.alert('공유 실패', errMsg(e)))}>
                    <Icon name="share-variant-outline" size={18} color={C.primary} />
                    <Text style={styles.actionText}>보내기</Text>
                  </Pressable>
                  <Pressable
                    style={styles.action}
                    onPress={() =>
                      savePhotosToGallery(insp, [item])
                        .then(() => Alert.alert('갤러리에 저장했습니다', '갤러리 › 앨범 › 현장점검'))
                        .catch((e) => Alert.alert('저장 실패', errMsg(e)))
                    }
                  >
                    <Icon name="download-outline" size={18} color={C.primary} />
                    <Text style={styles.actionText}>갤러리 저장</Text>
                  </Pressable>
                </View>
                {ctx ? (
                  <View style={styles.ctxBox}>
                    <Text style={styles.ctxLabel}>촬영 전후 대화</Text>
                    {ctx.before ? <Text style={styles.ctxText}>{ctx.before}</Text> : null}
                    <View style={styles.ctxMarkRow}>
                      <View style={styles.ctxMarkLine} />
                      <Icon name="camera" size={14} color={C.primary} />
                      <View style={styles.ctxMarkLine} />
                    </View>
                    {ctx.after ? <Text style={styles.ctxText}>{ctx.after}</Text> : null}
                  </View>
                ) : null}
                {playing?.key === key ? (
                  renderPlayer(key)
                ) : (
                  <BigButton
                    kind="dark"
                    icon="play-circle-outline"
                    title="앞뒤 30초 듣기"
                    busy={loadingKey === key}
                    disabled={!chunks}
                    onPress={() => playAround(key, item.taken_at)}
                    style={{ marginTop: 12, minHeight: 56 }}
                  />
                )}
              </View>
            </View>
          );
        }}
      />

      <Modal visible={!!viewer} onRequestClose={() => setViewer(null)} animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
          <View style={styles.viewerClose}>
            <Icon name="close" size={28} color={C.white} />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!memoFor} transparent animationType="fade" onRequestClose={() => setMemoFor(null)}>
        <View style={ui.modalBg}>
          <View style={ui.modal}>
            <Text style={ui.modalTitle}>사진 메모</Text>
            <TextInput value={memoText} onChangeText={setMemoText} autoFocus style={ui.input} maxLength={80} onSubmitEditing={saveMemo} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <BigButton title="취소" kind="dark" onPress={() => setMemoFor(null)} style={{ flex: 1 }} />
              <BigButton title="저장" icon="check" onPress={saveMemo} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
      {chunks === null ? <ActivityIndicator style={{ position: 'absolute', top: 80, right: 20 }} color={C.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  text: { color: C.text, fontSize: 17, fontFamily: F.medium },
  empty: { color: C.sub, fontSize: 15, fontFamily: F.medium },
  site: { ...T.h1 },
  meta: { color: C.sub, fontSize: 16, fontFamily: F.semibold, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 8, marginTop: 14 },
  chunkToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 18, paddingVertical: 8 },
  chunkToggleText: { color: C.sub, fontSize: 17, fontFamily: F.xbold },
  chunkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  chunkText: { color: C.text, fontSize: 17, fontFamily: F.bold, flex: 1, ...T.num },
  chunkDur: { color: C.sub, fontSize: 15, fontFamily: F.bold, ...T.num },
  tlRow: { flexDirection: 'row', paddingLeft: 10, paddingRight: S.pad },
  rail: { width: 40, alignItems: 'center' },
  railNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  railNumText: { color: '#1A1200', fontSize: 15, fontFamily: F.xbold },
  railLine: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 4 },
  card: {
    flex: 1,
    marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: S.radius,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTime: { color: C.text, fontSize: 19, fontFamily: F.xbold, ...T.num },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: C.surface2 },
  zoom: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: C.primarySoft },
  actionText: { fontFamily: F.semibold, fontSize: 13.5, color: C.primary },
  memoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, minHeight: 32 },
  memo: { color: C.text, fontSize: 18, fontFamily: F.xbold, flex: 1 },
  memoEmpty: { color: C.faint, fontSize: 16, fontFamily: F.bold },
  ctxBox: { marginTop: 10, backgroundColor: C.primarySoft, borderRadius: 10, padding: 12 },
  ctxLabel: { color: '#9CC5FF', fontSize: 12, fontFamily: F.xbold, letterSpacing: 1, marginBottom: 6 },
  ctxText: { color: C.text, fontSize: 16, lineHeight: 24 },
  ctxMarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 },
  ctxMarkLine: { flex: 1, height: 1, backgroundColor: '#2C4A73' },
  playerBox: { marginTop: 12, backgroundColor: C.surface2, borderRadius: 12, padding: 12 },
  progress: { height: 10, backgroundColor: C.surface3, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary },
  centerMark: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: C.red },
  playerTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  playerTime: { color: C.text, fontSize: 16, fontFamily: F.xbold, ...T.num },
  playerTimeSub: { color: C.sub, fontSize: 15, fontFamily: F.bold, ...T.num },
  playerRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 12,
    backgroundColor: C.surface3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pBtnMain: { backgroundColor: C.primary, flex: 1.4 },
  viewerClose: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 6 },
});

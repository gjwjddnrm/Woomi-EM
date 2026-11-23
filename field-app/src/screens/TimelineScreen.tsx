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
import { BigButton, Header } from '../components/ui';
import { useNav } from '../nav';
import { deleteInspectionFiles, listChunks, makeClip, totalRecordedMs } from '../storage';
import { C, S } from '../theme';
import { errMsg, fmtClock, fmtDate, fmtDuration, toFileUri } from '../util';
import { photoContext } from '../transcribe';

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
        <Text style={styles.playerTime}>
          {fmtClock(playing.clipStart + cur * 1000)} · {fmtDuration(cur * 1000)} / {fmtDuration(dur * 1000)}
        </Text>
        <View style={styles.playerRow}>
          <Pressable style={styles.pBtn} onPress={() => player.seekTo(Math.max(0, cur - 10))}>
            <Text style={styles.pBtnText}>−10초</Text>
          </Pressable>
          <Pressable style={styles.pBtn} onPress={() => (st.playing ? player.pause() : player.play())}>
            <Text style={styles.pBtnText}>{st.playing ? '❚❚ 일시정지' : '▶ 재생'}</Text>
          </Pressable>
          <Pressable style={styles.pBtn} onPress={() => player.seekTo(Math.min(dur, cur + 10))}>
            <Text style={styles.pBtnText}>+10초</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  const header = (
    <View style={{ padding: S.pad }}>
      <Text style={styles.site}>{insp.site}</Text>
      <Text style={styles.meta}>
        {fmtDate(insp.started_at)} {fmtClock(insp.started_at)}
        {insp.ended_at ? ` ~ ${fmtClock(insp.ended_at)}` : ' (진행 중)'}
      </Text>
      <Text style={styles.meta}>
        사진 {photos.length}장 · 녹음 {chunks ? `${fmtDuration(totalMs)} (${chunks.length}개 파일)` : '확인 중…'}
      </Text>

      {insp.status === 'ended' ? (
        <BigButton
          title="정리하기: 텍스트·보고서·PDF"
          sub="음성 변환 → 사진별 대화 연결 → 보고서 초안"
          onPress={() => {
            stop();
            nav.push({ name: 'report', id: insp.id });
          }}
          style={{ marginTop: 14 }}
        />
      ) : null}

      <Pressable onPress={() => setShowChunks((v) => !v)} style={styles.chunkToggle}>
        <Text style={styles.chunkToggleText}>{showChunks ? '▾' : '▸'} 녹음 파일 목록</Text>
      </Pressable>
      {showChunks && chunks
        ? chunks.map((c) => {
            const key = `chunk_${c.startMs}`;
            return (
              <View key={key}>
                <Pressable style={styles.chunkRow} onPress={() => playAround(key, c.startMs + c.durationMs / 2, c.durationMs / 2 + 1000, c.durationMs / 2 + 1000)}>
                  <Text style={styles.chunkText}>
                    {playing?.key === key ? '■' : loadingKey === key ? '…' : '▶'} {fmtClock(c.startMs)} · {fmtDuration(c.durationMs)}
                  </Text>
                </Pressable>
                {renderPlayer(key)}
              </View>
            );
          })
        : null}
      <Text style={styles.section}>시간순 타임라인</Text>
      {photos.length === 0 ? <Text style={styles.text}>사진이 없습니다.</Text> : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <Header
        title="타임라인"
        onBack={() => {
          stop();
          nav.reset({ name: 'home' });
        }}
        right={
          <Pressable onPress={onDelete} hitSlop={10}>
            <Text style={{ color: C.red, fontSize: 18, fontWeight: '800' }}>삭제</Text>
          </Pressable>
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
          return (
            <View style={styles.card}>
              <Text style={styles.cardTime}>
                #{index + 1} · +{fmtDuration(item.offset_ms)} · {fmtClock(item.taken_at)}
              </Text>
              <Pressable onPress={() => setViewer(item)}>
                <Image source={{ uri: item.uri }} style={styles.photo} resizeMode="cover" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setMemoText(item.memo ?? '');
                  setMemoFor(item);
                }}
              >
                <Text style={item.memo ? styles.memo : styles.memoEmpty}>{item.memo ? `✎ ${item.memo}` : '+ 메모 추가'}</Text>
              </Pressable>
              {ctx ? (
                <View style={styles.ctxBox}>
                  {ctx.before ? <Text style={styles.ctxText}>{ctx.before}</Text> : null}
                  <Text style={styles.ctxMark}>📷 촬영</Text>
                  {ctx.after ? <Text style={styles.ctxText}>{ctx.after}</Text> : null}
                </View>
              ) : null}
              <BigButton
                kind="dark"
                title={playing?.key === key ? '■ 정지' : '▶ 앞뒤 30초 듣기'}
                busy={loadingKey === key}
                disabled={!chunks}
                onPress={() => playAround(key, item.taken_at)}
                style={{ marginTop: 10 }}
              />
              {renderPlayer(key)}
            </View>
          );
        }}
      />

      <Modal visible={!!viewer} onRequestClose={() => setViewer(null)} animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setViewer(null)}>
          {viewer ? <Image source={{ uri: viewer.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>

      <Modal visible={!!memoFor} transparent animationType="fade" onRequestClose={() => setMemoFor(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>사진 메모</Text>
            <TextInput
              value={memoText}
              onChangeText={setMemoText}
              autoFocus
              style={styles.memoInput}
              maxLength={80}
              onSubmitEditing={saveMemo}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <BigButton title="취소" kind="dark" onPress={() => setMemoFor(null)} style={{ flex: 1 }} />
              <BigButton title="저장" onPress={saveMemo} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
      {chunks === null ? <ActivityIndicator style={{ position: 'absolute', top: 80, right: 20 }} color={C.yellow} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  text: { color: C.text, fontSize: 18 },
  site: { color: C.text, fontSize: 28, fontWeight: '900' },
  meta: { color: C.sub, fontSize: 17, marginTop: 4 },
  section: { color: C.text, fontSize: 22, fontWeight: '900', marginTop: 22 },
  chunkToggle: { marginTop: 16, paddingVertical: 8 },
  chunkToggleText: { color: C.yellow, fontSize: 19, fontWeight: '800' },
  chunkRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  chunkText: { color: C.text, fontSize: 18, fontWeight: '700' },
  card: {
    marginHorizontal: S.pad,
    marginBottom: 18,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 12,
  },
  cardTime: { color: C.yellow, fontSize: 19, fontWeight: '900', marginBottom: 8 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#222' },
  memo: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: 10 },
  memoEmpty: { color: C.sub, fontSize: 18, fontWeight: '700', marginTop: 10 },
  ctxBox: { marginTop: 10, backgroundColor: '#0B0B0B', borderRadius: 8, padding: 10, borderLeftWidth: 4, borderLeftColor: C.blue },
  ctxText: { color: C.text, fontSize: 17, lineHeight: 25 },
  ctxMark: { color: C.blue, fontSize: 15, fontWeight: '900', marginVertical: 4 },
  playerBox: { marginTop: 10, backgroundColor: '#0B0B0B', borderRadius: 10, padding: 12 },
  progress: { height: 14, backgroundColor: '#333', borderRadius: 7, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.yellow },
  centerMark: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: C.red },
  playerTime: { color: C.text, fontSize: 16, fontWeight: '700', marginTop: 8 },
  playerRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  pBtn: {
    flex: 1,
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pBtnText: { color: C.text, fontSize: 18, fontWeight: '800' },
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

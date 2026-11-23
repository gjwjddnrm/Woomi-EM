import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DB from '../db';
import { BigButton, Header, Icon, IconButton, Pill, SectionLabel } from '../components/ui';
import { useNav } from '../nav';
import { buildPdf, sharePdf } from '../pdf';
import { type Report, type ReportItem, generateReport, loadReport, saveReportEdits } from '../report';
import { listChunks } from '../storage';
import { type TranscribeProgress, transcribeInspection } from '../transcribe';
import { C, S } from '../theme';
import { errMsg } from '../util';

function Field(props: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.fLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChange}
        multiline={props.multiline}
        placeholderTextColor={C.faint}
        style={[styles.fInput, props.multiline && { minHeight: 64, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export default function ReportScreen({ id }: { id: string }) {
  const nav = useNav();
  const [insp] = useState(() => DB.getInspection(id));
  const [prog, setProg] = useState<TranscribeProgress | null>(null);
  const [chunkTotal, setChunkTotal] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState(() => DB.listTranscripts(id).length);
  const [busy, setBusy] = useState<null | 'stt' | 'report' | 'pdf'>(null);
  const [status, setStatus] = useState('');
  const [report, setReport] = useState<Report | null>(() => loadReport(id));
  const [dirty, setDirty] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (insp) listChunks(insp).then((c) => setChunkTotal(c.filter((x) => !x.active).length));
    return () => {
      cancelRef.current = true;
    };
  }, [insp]);

  const save = useCallback(
    (r: Report) => {
      setReport(r);
      setDirty(true);
    },
    []
  );

  useEffect(() => {
    if (!dirty || !report) return;
    const t = setTimeout(() => {
      saveReportEdits(id, report);
      setDirty(false);
    }, 600);
    return () => clearTimeout(t);
  }, [dirty, report, id]);

  if (!insp) return null;

  const runStt = async () => {
    setBusy('stt');
    cancelRef.current = false;
    try {
      const p = await transcribeInspection(insp, setProg, () => cancelRef.current);
      setDoneCount(DB.listTranscripts(id).length);
      if (p.failed > 0) Alert.alert('일부 실패', `${p.failed}개 조각을 변환하지 못했습니다. 다시 누르면 실패한 것만 다시 합니다.\n${p.message ?? ''}`);
    } catch (e) {
      Alert.alert('텍스트 변환 실패', errMsg(e));
    } finally {
      setBusy(null);
      setDoneCount(DB.listTranscripts(id).length);
    }
  };

  const runReport = async () => {
    const go = async () => {
      setBusy('report');
      try {
        const r = await generateReport(insp, setStatus);
        setReport(r);
      } catch (e) {
        Alert.alert('보고서 초안 실패', errMsg(e));
      } finally {
        setBusy(null);
        setStatus('');
      }
    };
    if (report) {
      Alert.alert('다시 만들까요?', '지금 고친 내용은 새 초안으로 바뀝니다.', [
        { text: '취소', style: 'cancel' },
        { text: '다시 만들기', style: 'destructive', onPress: go },
      ]);
    } else go();
  };

  const runPdf = async () => {
    setBusy('pdf');
    try {
      if (report) saveReportEdits(id, report);
      const uri = await buildPdf(insp, report, setStatus);
      setStatus('');
      await sharePdf(uri);
    } catch (e) {
      Alert.alert('PDF 실패', errMsg(e));
    } finally {
      setBusy(null);
      setStatus('');
    }
  };

  const setItem = (i: number, patch: Partial<ReportItem>) => {
    if (!report) return;
    const items = report.items.map((it, k) => (k === i ? { ...it, ...patch } : it));
    save({ ...report, items });
  };

  const sttLabel =
    busy === 'stt' && prog
      ? `변환 중 ${prog.done}/${prog.total}${prog.failed ? ` (실패 ${prog.failed})` : ''}`
      : chunkTotal !== null && doneCount >= chunkTotal && chunkTotal > 0
        ? '✓ 변환 완료 (다시 확인)'
        : `음성 → 텍스트 변환${chunkTotal !== null ? ` (${doneCount}/${chunkTotal})` : ''}`;

  const sttDone = chunkTotal !== null && chunkTotal > 0 && doneCount >= chunkTotal;

  const StepCard = (p: { n: number; title: string; done?: boolean; children: React.ReactNode }) => (
    <View style={styles.stepCard}>
      <View style={styles.stepHead}>
        <View style={[styles.stepNum, p.done && { backgroundColor: C.green }]}>
          {p.done ? <Icon name="check" size={20} color="#06210F" /> : <Text style={styles.stepNumText}>{p.n}</Text>}
        </View>
        <Text style={styles.stepTitle}>{p.title}</Text>
      </View>
      {p.children}
    </View>
  );

  return (
    <View style={styles.root}>
      <Header title="정리하기" subtitle={insp.site} onBack={() => nav.back()} />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <StepCard n={1} title="음성 → 텍스트" done={sttDone}>
          {chunkTotal !== null && chunkTotal > 0 ? (
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${Math.min(100, ((busy === 'stt' && prog ? prog.done : doneCount) / chunkTotal) * 100)}%` },
                ]}
              />
            </View>
          ) : null}
          <BigButton title={sttLabel} icon="text-recognition" onPress={runStt} disabled={!!busy} kind={sttDone ? 'dark' : 'primary'} />
          {busy === 'stt' ? (
            <BigButton title="멈추기" icon="pause" kind="dark" onPress={() => (cancelRef.current = true)} style={{ marginTop: 8 }} />
          ) : null}
          <Text style={styles.help}>OpenAI Whisper · 1분씩 변환·저장, 끊겨도 이어서. 변환되면 사진마다 앞뒤 대화가 붙습니다.</Text>
        </StepCard>

        <StepCard n={2} title="보고서 초안" done={!!report}>
          <BigButton
            title={report ? '초안 다시 만들기' : '보고서 초안 만들기'}
            icon="robot-outline"
            onPress={runReport}
            disabled={!!busy}
            busy={busy === 'report'}
            kind={report ? 'dark' : 'primary'}
          />
          <Text style={styles.help}>Claude · 지적사항 / 조치 필요사항 / 담당·기한. 만든 뒤 아래에서 바로 고칠 수 있습니다.</Text>
        </StepCard>

        <StepCard n={3} title="PDF 내보내기 · 공유">
          <BigButton title="PDF 만들고 공유" sub="카카오톡 · 메일 · 드라이브" icon="file-pdf-box" onPress={runPdf} disabled={!!busy} busy={busy === 'pdf'} />
        </StepCard>

        {status ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={C.accent} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {report ? (
          <View style={{ marginTop: 18 }}>
            <SectionLabel text="보고서 초안" right={<Pill icon={dirty ? 'sync' : 'cloud-check-outline'} text={dirty ? '저장 중' : '자동 저장됨'} />} />
            <View style={styles.docCard}>
              <Field label="제목" value={report.title} onChange={(v) => save({ ...report, title: v })} />
              <Field label="요약" value={report.summary} multiline onChange={(v) => save({ ...report, summary: v })} />
            </View>
            {report.items.map((it, i) => (
              <View key={i} style={styles.item}>
                <View style={styles.itemHead}>
                  <View style={styles.itemNo}>
                    <Text style={styles.itemNoText}>{i + 1}</Text>
                  </View>
                  <Pill icon="camera-outline" text={it.photos.length ? `사진 ${it.photos.join(', ')}` : '사진 없음'} />
                  <View style={{ flex: 1 }} />
                  <IconButton
                    icon="trash-can-outline"
                    color={C.red}
                    onPress={() =>
                      Alert.alert('이 항목을 지울까요?', it.finding, [
                        { text: '취소', style: 'cancel' },
                        { text: '삭제', style: 'destructive', onPress: () => save({ ...report, items: report.items.filter((_, k) => k !== i) }) },
                      ])
                    }
                  />
                </View>
                <Field label="지적사항" value={it.finding} multiline onChange={(v) => setItem(i, { finding: v })} />
                <Field label="조치 필요사항" value={it.action} multiline onChange={(v) => setItem(i, { action: v })} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="담당" value={it.owner} onChange={(v) => setItem(i, { owner: v })} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="기한" value={it.due} onChange={(v) => setItem(i, { due: v })} />
                  </View>
                </View>
                {it.evidence ? (
                  <View style={styles.evidenceBox}>
                    <Icon name="format-quote-open" size={18} color={C.faint} />
                    <Text style={styles.evidence}>{it.evidence}</Text>
                  </View>
                ) : null}
              </View>
            ))}
            <BigButton
              kind="dark"
              icon="plus"
              title="항목 추가"
              onPress={() =>
                save({ ...report, items: [...report.items, { photos: [], finding: '', action: '', owner: '미정', due: '미정', evidence: '' }] })
              }
              style={{ marginTop: 4 }}
            />
            {report.notes.length ? (
              <View style={[styles.docCard, { marginTop: 14 }]}>
                <Text style={styles.fLabel}>참고사항</Text>
                {report.notes.map((n, i) => (
                  <Text key={i} style={styles.note}>
                    • {n}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  stepCard: { backgroundColor: C.surface, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, padding: 16, marginBottom: 12 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepNum: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#1A1200', fontSize: 17, fontWeight: '900' },
  stepTitle: { color: C.text, fontSize: 19, fontWeight: '800' },
  bar: { height: 8, borderRadius: 4, backgroundColor: C.surface3, overflow: 'hidden', marginBottom: 12 },
  barFill: { height: '100%', backgroundColor: C.green },
  help: { color: C.sub, fontSize: 14, lineHeight: 21, marginTop: 10 },
  statusBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 4, padding: 14, borderRadius: 12, backgroundColor: C.surface2 },
  statusText: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1 },
  docCard: { backgroundColor: C.surface, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  item: { backgroundColor: C.surface, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, borderLeftWidth: 4, borderLeftColor: C.accent, padding: 14, marginBottom: 12 },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemNo: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.surface3, alignItems: 'center', justifyContent: 'center' },
  itemNoText: { color: C.text, fontSize: 16, fontWeight: '900' },
  fLabel: { color: C.faint, fontSize: 13, fontWeight: '900', letterSpacing: 0.8 },
  fInput: {
    backgroundColor: C.surface2,
    color: C.text,
    fontSize: 17,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  evidenceBox: { flexDirection: 'row', gap: 6, marginTop: 12, backgroundColor: C.surface2, borderRadius: 10, padding: 10 },
  evidence: { color: C.sub, fontSize: 15, flex: 1, lineHeight: 22 },
  note: { color: C.text, fontSize: 16, lineHeight: 25, marginTop: 4 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DB from '../db';
import { BigButton, Header } from '../components/ui';
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

  return (
    <View style={styles.root}>
      <Header title="정리하기" onBack={() => nav.back()} />
      <ScrollView contentContainerStyle={{ padding: S.pad, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.site}>{insp.site}</Text>

        <Text style={styles.step}>1. 음성 → 텍스트 (Whisper)</Text>
        <BigButton title={sttLabel} onPress={runStt} busy={false} disabled={!!busy} />
        {busy === 'stt' ? (
          <BigButton title="멈추기" kind="dark" onPress={() => (cancelRef.current = true)} style={{ marginTop: 8 }} />
        ) : null}
        <Text style={styles.help}>1분 조각씩 변환하고 바로 저장합니다. 끊겨도 다시 누르면 이어서 합니다. 변환되면 타임라인의 사진마다 앞뒤 대화가 붙습니다.</Text>

        <Text style={styles.step}>2. 보고서 초안 (Claude)</Text>
        <BigButton
          title={report ? '초안 다시 만들기' : '보고서 초안 만들기'}
          onPress={runReport}
          disabled={!!busy}
          busy={busy === 'report'}
        />
        <Text style={styles.help}>지적사항 / 조치 필요사항 / 담당·기한 형식으로 만듭니다. 만든 뒤 아래에서 바로 고칠 수 있습니다.</Text>

        <Text style={styles.step}>3. PDF 내보내기 · 공유</Text>
        <BigButton title="PDF 만들고 공유 (카톡·메일)" onPress={runPdf} disabled={!!busy} busy={busy === 'pdf'} />

        {status ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={C.yellow} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        ) : null}

        {report ? (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.step}>보고서 초안 {dirty ? '(저장 중…)' : '(자동 저장됨)'}</Text>
            <Field label="제목" value={report.title} onChange={(v) => save({ ...report, title: v })} />
            <Field label="요약" value={report.summary} multiline onChange={(v) => save({ ...report, summary: v })} />
            {report.items.map((it, i) => (
              <View key={i} style={styles.item}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.itemNo}>
                    {i + 1}. {it.photos.length ? `사진 ${it.photos.join(', ')}` : '사진 없음'}
                  </Text>
                  <Text
                    style={styles.del}
                    onPress={() =>
                      Alert.alert('이 항목을 지울까요?', it.finding, [
                        { text: '취소', style: 'cancel' },
                        { text: '삭제', style: 'destructive', onPress: () => save({ ...report, items: report.items.filter((_, k) => k !== i) }) },
                      ])
                    }
                  >
                    삭제
                  </Text>
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
                {it.evidence ? <Text style={styles.evidence}>근거: “{it.evidence}”</Text> : null}
              </View>
            ))}
            <BigButton
              kind="dark"
              title="+ 항목 추가"
              onPress={() =>
                save({ ...report, items: [...report.items, { photos: [], finding: '', action: '', owner: '미정', due: '미정', evidence: '' }] })
              }
              style={{ marginTop: 10 }}
            />
            {report.notes.length ? (
              <View style={{ marginTop: 16 }}>
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
  site: { color: C.text, fontSize: 26, fontWeight: '900', marginBottom: 4 },
  step: { color: C.yellow, fontSize: 21, fontWeight: '900', marginTop: 20, marginBottom: 8 },
  help: { color: C.sub, fontSize: 16, lineHeight: 23, marginTop: 8 },
  statusBox: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: C.card },
  statusText: { color: C.text, fontSize: 18, fontWeight: '700', flex: 1 },
  item: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, padding: 12, marginTop: 12 },
  itemNo: { color: C.yellow, fontSize: 18, fontWeight: '900' },
  del: { color: C.red, fontSize: 17, fontWeight: '800', padding: 6 },
  fLabel: { color: C.sub, fontSize: 15, fontWeight: '800' },
  fInput: { backgroundColor: '#fff', color: '#000', fontSize: 18, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  evidence: { color: C.sub, fontSize: 15, marginTop: 8, fontStyle: 'italic' },
  note: { color: C.text, fontSize: 17, lineHeight: 25 },
});

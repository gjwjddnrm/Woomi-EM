import { Directory, File, Paths } from 'expo-file-system';
import FieldRecorder, { type Chunk } from '../modules/field-recorder';
import * as DB from './db';
import { getEngine, getKey } from './keys';
import { geminiGenerate, parseJsonLoose } from './gemini';
import { listChunks } from './storage';
import { toNativePath } from './util';
import type { Transcript } from './db';

export type Seg = { start: number; end: number; text: string }; // 절대 시각(ms)

/** 저장된 변환 결과(조각별)를 절대 시각 구간 목록으로 펼친다 */
export function flattenSegments(ts: Transcript[]): Seg[] {
  const out: Seg[] = [];
  for (const t of ts) {
    let segs: { start: number; end: number; text: string }[] = [];
    try {
      segs = JSON.parse(t.segments);
    } catch {}
    if (segs.length === 0 && t.text.trim()) {
      out.push({ start: t.chunk_start, end: t.chunk_start + t.duration_ms, text: t.text.trim() });
      continue;
    }
    for (const s of segs) {
      const text = (s.text ?? '').trim();
      if (!text) continue;
      out.push({ start: t.chunk_start + s.start * 1000, end: t.chunk_start + s.end * 1000, text });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** 사진 촬영 시점 앞뒤(기본 30초)의 대화를 이어 붙인다 */
export function photoContext(
  ts: Transcript[] | Seg[],
  takenAt: number,
  beforeMs = 30_000,
  afterMs = 30_000
): { before: string; after: string } | null {
  const segs: Seg[] =
    ts.length > 0 && 'chunk_start' in (ts[0] as object) ? flattenSegments(ts as Transcript[]) : (ts as Seg[]);
  const before = segs
    .filter((s) => s.end > takenAt - beforeMs && s.start < takenAt)
    .map((s) => s.text)
    .join(' ');
  const after = segs
    .filter((s) => s.start >= takenAt && s.start < takenAt + afterMs)
    .map((s) => s.text)
    .join(' ');
  if (!before && !after) return null;
  return { before, after };
}

// ───────────── 음성 → 텍스트 (OpenAI Whisper) ─────────────

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';
const BASE_PROMPT = '건설 현장 소방·안전 점검 대화입니다. 지적사항, 조치, 담당자, 기한, 소화기, 스프링클러, 감지기, 유도등, 방화문.';

export type TranscribeProgress = { done: number; total: number; failed: number; skipped: number; message?: string };

async function whisperOnce(key: string, fileUri: string, prompt: string): Promise<{ text: string; segments: Seg[] }> {
  const form = new FormData();
  // React Native FormData 파일 형식
  form.append('file', { uri: fileUri, name: 'audio.m4a', type: 'audio/mp4' } as unknown as Blob);
  form.append('model', 'whisper-1');
  form.append('language', 'ko');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  form.append('prompt', prompt.slice(-800));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: ctrl.signal,
    });
    const body = await res.text();
    if (!res.ok) {
      let msg = body;
      try {
        msg = JSON.parse(body)?.error?.message ?? body;
      } catch {}
      const err = new Error(`Whisper ${res.status}: ${msg}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    const j = JSON.parse(body) as { text?: string; segments?: { start: number; end: number; text: string }[] };
    return {
      text: (j.text ?? '').trim(),
      segments: (j.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 말소리만 이어 붙인 오디오의 시각(초) → 원래 조각의 시각(초) */
function mapToOriginal(t: number, spans: number[]): number {
  let acc = 0;
  for (let k = 0; k + 1 < spans.length; k += 2) {
    const len = (spans[k + 1] - spans[k]) / 1000;
    if (t <= acc + len) return spans[k] / 1000 + (t - acc);
    acc += len;
  }
  return spans.length ? spans[spans.length - 1] / 1000 : t;
}

export type ChunkResult = 'done' | 'silent';

async function transcribeChunk(key: string, insp: DB.Inspection, c: Chunk, prevText: string): Promise<ChunkResult> {
  const tmpDir = new Directory(Paths.cache, 'whisper');
  if (!tmpDir.exists) tmpDir.create({ intermediates: true, idempotent: true });
  const out = new File(tmpDir, `w_${c.startMs}.m4a`);
  const empty = () =>
    DB.saveTranscript({ inspection_id: insp.id, chunk_start: c.startMs, duration_ms: c.durationMs, text: '', segments: '[]' });

  // 1) 말소리 구간 찾기. 무음뿐이면 보내지 않는다(비용 0, Whisper가 무음에서 지어내는 문장도 막음).
  let spans: number[] | null = null;
  try {
    spans = await FieldRecorder.speechSpans(c.path);
  } catch {
    spans = null;
  }
  if (spans && spans.length === 0) {
    empty();
    return 'silent';
  }
  // 2) 말소리만 이어 붙인 파일(측정 불가 기기는 조각 전체)
  if (spans) {
    const ms = await FieldRecorder.writeSpans(c.path, spans, toNativePath(out.uri));
    if (ms <= 0) spans = null;
  }
  if (!spans) {
    const r = await FieldRecorder.mergeToM4a([c.path], [c.startMs], toNativePath(out.uri));
    if (!r) {
      empty();
      return 'silent';
    }
  }
  try {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = await whisperOnce(key, out.uri, `${BASE_PROMPT} ${prevText}`);
        const segs = spans
          ? t.segments.map((g) => ({ start: mapToOriginal(g.start, spans!), end: mapToOriginal(g.end, spans!), text: g.text }))
          : t.segments;
        DB.saveTranscript({
          inspection_id: insp.id,
          chunk_start: c.startMs,
          duration_ms: c.durationMs,
          text: t.text,
          // 조각 기준 초 단위
          segments: JSON.stringify(segs),
        });
        return 'done';
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 400 || status === 403) break; // 다시 해도 안 되는 오류
        await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
      }
    }
    throw lastErr;
  } finally {
    try {
      out.delete();
    } catch {}
  }
}

async function transcribeChunkGemini(
  key: string,
  insp: DB.Inspection,
  c: Chunk,
  prevText: string,
  onWait: (sec: number) => void
): Promise<ChunkResult> {
  const empty = () =>
    DB.saveTranscript({ inspection_id: insp.id, chunk_start: c.startMs, duration_ms: c.durationMs, text: '', segments: '[]' });
  let spans: number[] | null = null;
  try {
    spans = await FieldRecorder.speechSpans(c.path);
  } catch {
    spans = null;
  }
  if (spans && spans.length === 0) {
    empty();
    return 'silent';
  }
  const tmpDir = new Directory(Paths.cache, 'gemini');
  if (!tmpDir.exists) tmpDir.create({ intermediates: true, idempotent: true });
  const out = new File(tmpDir, `g_${c.startMs}.aac`);
  try {
    const ms = await FieldRecorder.writeSpansAac(c.path, spans, toNativePath(out.uri));
    if (ms <= 0) {
      empty();
      return 'silent';
    }
    const b64 = await FieldRecorder.readBase64(toNativePath(out.uri));
    const prompt =
      `건설 현장 소방·안전 점검 중 녹음한 한국어 대화입니다 (길이 약 ${Math.round(ms / 1000)}초).\n` +
      '들리는 말을 그대로 받아쓰세요. 들리지 않는 부분은 지어내지 말고, 말소리가 없으면 빈 배열을 주세요.\n' +
      (prevText ? `바로 앞 대화(참고용, 다시 쓰지 말 것): ${prevText}\n` : '') +
      '답은 JSON 배열만: [{"start": 시작초, "end": 끝초, "text": "말한 내용"}] — 시각은 이 오디오 시작 기준 초.';
    const text = await geminiGenerate(key, [{ text: prompt }, { inlineData: { mimeType: 'audio/aac', data: b64 } }], {
      onWait,
      timeoutMs: 120_000,
    });
    const arr = parseJsonLoose<{ start?: number; end?: number; text?: string }[] | { segments?: unknown }>(text);
    const list = (Array.isArray(arr) ? arr : ((arr as { segments?: unknown }).segments as unknown[]) ?? []) as {
      start?: number;
      end?: number;
      text?: string;
    }[];
    const segs = list
      .filter((g) => (g.text ?? '').trim())
      .map((g) => {
        const st = Math.max(0, Number(g.start) || 0);
        const en = Math.max(st, Number(g.end) || st + 2);
        return spans
          ? { start: mapToOriginal(st, spans), end: mapToOriginal(en, spans), text: String(g.text).trim() }
          : { start: st, end: en, text: String(g.text).trim() };
      });
    DB.saveTranscript({
      inspection_id: insp.id,
      chunk_start: c.startMs,
      duration_ms: c.durationMs,
      text: segs.map((g) => g.text).join(' '),
      segments: JSON.stringify(segs),
    });
    return segs.length ? 'done' : 'silent';
  } finally {
    try {
      out.delete();
    } catch {}
  }
}

/** 아직 변환하지 않은 녹음 조각만 변환한다. 중간에 끊겨도 다시 누르면 이어서 한다. */
export async function transcribeInspection(
  insp: DB.Inspection,
  onProgress: (p: TranscribeProgress) => void,
  isCancelled: () => boolean
): Promise<TranscribeProgress> {
  const engine = getEngine();
  const key = await getKey(engine === 'gemini' ? 'gemini' : 'openai');
  if (!key) throw new Error(engine === 'gemini' ? '설정에서 Gemini API 키를 먼저 입력하세요.' : '설정에서 OpenAI API 키를 먼저 입력하세요.');
  const chunks = (await listChunks(insp)).filter((c) => !c.active);
  const doneSet = new Set(DB.listTranscripts(insp.id).map((t) => t.chunk_start));
  const todo = chunks.filter((c) => !doneSet.has(c.startMs));
  const prog: TranscribeProgress = { done: chunks.length - todo.length, total: chunks.length, failed: 0, skipped: 0 };
  onProgress({ ...prog });
  const textOf = (start: number) => DB.listTranscripts(insp.id).filter((t) => t.chunk_start < start).slice(-1)[0]?.text ?? '';
  for (const c of todo) {
    if (isCancelled()) break;
    try {
      const r =
        engine === 'gemini'
          ? await transcribeChunkGemini(key, insp, c, textOf(c.startMs).slice(-200), (sec) =>
              onProgress({ ...prog, message: `무료 사용량 제한 — ${sec}초 기다렸다 이어서 합니다` })
            )
          : await transcribeChunk(key, insp, c, textOf(c.startMs).slice(-200));
      prog.done++;
      if (r === 'silent') prog.skipped++;
    } catch (e) {
      prog.failed++;
      prog.message = e instanceof Error ? e.message : String(e);
      if (/401|403|invalid_api_key|Incorrect API key|키가 올바르지|키 권한|무료 사용량을 다 썼/i.test(prog.message)) {
        onProgress({ ...prog });
        throw new Error(/무료 사용량/.test(prog.message) ? prog.message : `${engine === 'gemini' ? 'Gemini' : 'OpenAI'} API 키가 올바르지 않습니다. 설정에서 확인하세요.`);
      }
    }
    onProgress({ ...prog });
  }
  return prog;
}

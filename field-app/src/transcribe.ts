import { Directory, File, Paths } from 'expo-file-system';
import FieldRecorder, { type Chunk } from '../modules/field-recorder';
import * as DB from './db';
import { getKey } from './keys';
import { listChunks } from './storage';
import { toFileUri, toNativePath } from './util';
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

export type TranscribeProgress = { done: number; total: number; failed: number; message?: string };

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

async function transcribeChunk(key: string, insp: DB.Inspection, c: Chunk, prevText: string): Promise<void> {
  const tmpDir = new Directory(Paths.cache, 'whisper');
  if (!tmpDir.exists) tmpDir.create({ intermediates: true, idempotent: true });
  const out = new File(tmpDir, `w_${c.startMs}.m4a`);
  const r = await FieldRecorder.mergeToM4a([c.path], [c.startMs], toNativePath(out.uri));
  if (!r) {
    DB.saveTranscript({ inspection_id: insp.id, chunk_start: c.startMs, duration_ms: c.durationMs, text: '', segments: '[]' });
    return;
  }
  try {
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = await whisperOnce(key, toFileUri(r.path), `${BASE_PROMPT} ${prevText}`);
        DB.saveTranscript({
          inspection_id: insp.id,
          chunk_start: c.startMs,
          duration_ms: c.durationMs,
          text: t.text,
          // 조각 기준 초 단위
          segments: JSON.stringify(t.segments),
        });
        return;
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

/** 아직 변환하지 않은 녹음 조각만 변환한다. 중간에 끊겨도 다시 누르면 이어서 한다. */
export async function transcribeInspection(
  insp: DB.Inspection,
  onProgress: (p: TranscribeProgress) => void,
  isCancelled: () => boolean
): Promise<TranscribeProgress> {
  const key = await getKey('openai');
  if (!key) throw new Error('설정에서 OpenAI API 키를 먼저 입력하세요.');
  const chunks = (await listChunks(insp)).filter((c) => !c.active);
  const doneSet = new Set(DB.listTranscripts(insp.id).map((t) => t.chunk_start));
  const todo = chunks.filter((c) => !doneSet.has(c.startMs));
  const prog: TranscribeProgress = { done: chunks.length - todo.length, total: chunks.length, failed: 0 };
  onProgress({ ...prog });
  const textOf = (start: number) => DB.listTranscripts(insp.id).filter((t) => t.chunk_start < start).slice(-1)[0]?.text ?? '';
  for (const c of todo) {
    if (isCancelled()) break;
    try {
      await transcribeChunk(key, insp, c, textOf(c.startMs).slice(-200));
      prog.done++;
    } catch (e) {
      prog.failed++;
      prog.message = e instanceof Error ? e.message : String(e);
      if (/401|403|invalid_api_key|Incorrect API key/i.test(prog.message)) {
        onProgress({ ...prog });
        throw new Error('OpenAI API 키가 올바르지 않습니다. 설정에서 확인하세요.');
      }
    }
    onProgress({ ...prog });
  }
  return prog;
}

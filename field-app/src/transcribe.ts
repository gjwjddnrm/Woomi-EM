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

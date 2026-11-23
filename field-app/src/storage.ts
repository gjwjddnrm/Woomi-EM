import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import FieldRecorder, { type Chunk, type ClipResult } from '../modules/field-recorder';
import * as DB from './db';
import { newId, toNativePath } from './util';

const MAX_EDGE = 1920;
const JPEG_QUALITY = 0.7;

export function inspectionsRoot(): Directory {
  const d = new Directory(Paths.document, 'inspections');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function makeInspectionDir(id: string): Directory {
  const d = new Directory(inspectionsRoot(), id);
  d.create({ intermediates: true, idempotent: true });
  new Directory(d, 'audio').create({ intermediates: true, idempotent: true });
  new Directory(d, 'photos').create({ intermediates: true, idempotent: true });
  return d;
}

export function audioDirPath(insp: DB.Inspection): string {
  return toNativePath(new Directory(insp.dir, 'audio').uri);
}

export function photosDir(insp: DB.Inspection): Directory {
  const d = new Directory(insp.dir, 'photos');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

export function exportsDir(insp: DB.Inspection): Directory {
  const d = new Directory(insp.dir, 'exports');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/**
 * 찍은 사진을 즉시 점검 폴더로 옮기고 DB에 기록한다. 압축은 뒤에서 따로 한다.
 * (압축 중 앱이 죽어도 원본은 남아 있고, 다음 실행 때 다시 압축한다)
 */
export function savePhotoNow(
  insp: DB.Inspection,
  tempUri: string,
  takenAt: number,
  size: { width: number; height: number }
): DB.Photo {
  const id = newId();
  const src = new File(tempUri);
  const dest = new File(photosDir(insp), `${takenAt}_${id}.jpg`);
  try {
    src.move(dest);
  } catch {
    src.copy(dest);
    try {
      src.delete();
    } catch {}
  }
  const photo: DB.Photo = {
    id,
    inspection_id: insp.id,
    taken_at: takenAt,
    offset_ms: Math.max(0, takenAt - insp.started_at),
    uri: dest.uri,
    memo: null,
    compressed: 0,
    width: size.width || null,
    height: size.height || null,
  };
  DB.insertPhoto(photo);
  enqueueCompression(photo);
  return photo;
}

// ── 압축 대기열 (한 번에 하나씩) ──
let queue: Promise<void> = Promise.resolve();
const queued = new Set<string>();

export function enqueueCompression(p: DB.Photo): void {
  if (queued.has(p.id)) return;
  queued.add(p.id);
  queue = queue
    .then(() => compressPhoto(p))
    .catch((e) => console.warn('compress failed', p.id, e))
    .finally(() => {
      queued.delete(p.id);
    });
}

export function resumePendingCompression(): void {
  try {
    for (const p of DB.listUncompressedPhotos()) enqueueCompression(p);
  } catch (e) {
    console.warn('resume compression', e);
  }
}

async function compressPhoto(p: DB.Photo): Promise<void> {
  const file = new File(p.uri);
  if (!file.exists) {
    DB.markPhotoCompressed(p.id, p.width ?? 0, p.height ?? 0);
    return;
  }
  const ctx = ImageManipulator.manipulate(p.uri);
  const w = p.width ?? 0;
  const h = p.height ?? 0;
  if (w > MAX_EDGE || h > MAX_EDGE || (!w && !h)) {
    if (w >= h) ctx.resize({ width: MAX_EDGE, height: null });
    else ctx.resize({ width: null, height: MAX_EDGE });
  }
  const img = await ctx.renderAsync();
  const out = await img.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG });
  const tmp = new File(out.uri);
  // 같은 폴더에 임시 파일로 옮긴 뒤 바꿔치기 (중간에 죽어도 원본 또는 압축본 중 하나는 온전히 남음)
  const staged = new File(file.parentDirectory, `${file.name}.tmp`);
  if (staged.exists) staged.delete();
  tmp.move(staged);
  file.delete();
  staged.move(new File(file.parentDirectory, file.name));
  DB.markPhotoCompressed(p.id, out.width, out.height);
}

// ── 녹음 조각 ──
export async function listChunks(insp: DB.Inspection): Promise<Chunk[]> {
  try {
    return await FieldRecorder.listChunks(audioDirPath(insp));
  } catch (e) {
    console.warn('listChunks', e);
    return [];
  }
}

export function totalRecordedMs(chunks: Chunk[]): number {
  return chunks.reduce((a, c) => a + c.durationMs, 0);
}

/** 사진 시점 앞뒤 30초(기본) 구간을 잘라 재생용 m4a로 만든다. */
export async function makeClip(
  insp: DB.Inspection,
  chunks: Chunk[],
  centerMs: number,
  beforeMs = 30_000,
  afterMs = 30_000
): Promise<ClipResult | null> {
  const from = centerMs - beforeMs;
  const to = centerMs + afterMs;
  const use = chunks.filter((c) => c.startMs + c.durationMs > from && c.startMs < to);
  if (use.length === 0) return null;
  const cache = new Directory(Paths.cache, 'clips');
  if (!cache.exists) cache.create({ intermediates: true, idempotent: true });
  const out = new File(cache, `clip_${insp.id}_${Math.round(centerMs)}.m4a`);
  return FieldRecorder.writeClip(
    use.map((c) => c.path),
    use.map((c) => c.startMs),
    from,
    to,
    toNativePath(out.uri)
  );
}

export function clearClipCache(): void {
  try {
    const cache = new Directory(Paths.cache, 'clips');
    if (cache.exists) cache.delete();
  } catch {}
}

export function deleteInspectionFiles(insp: DB.Inspection): void {
  try {
    const d = new Directory(insp.dir);
    if (d.exists) d.delete();
  } catch (e) {
    console.warn('delete dir', e);
  }
}

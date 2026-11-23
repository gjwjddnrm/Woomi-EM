import * as SQLite from 'expo-sqlite';

export type Inspection = {
  id: string;
  site: string;
  started_at: number;
  ended_at: number | null;
  status: 'active' | 'ended';
  dir: string; // file:// URI (끝에 / 없음)
};

export type Photo = {
  id: string;
  inspection_id: string;
  taken_at: number; // epoch ms
  offset_ms: number; // 점검(녹음) 시작 기준 경과 시간
  uri: string;
  memo: string | null;
  compressed: number;
  width: number | null;
  height: number | null;
};

export type Transcript = {
  inspection_id: string;
  chunk_start: number;
  duration_ms: number;
  text: string;
  segments: string; // JSON: {start,end,text}[] (초, 조각 기준)
};

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync('field.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY NOT NULL,
      site TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      status TEXT NOT NULL,
      dir TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY NOT NULL,
      inspection_id TEXT NOT NULL,
      taken_at INTEGER NOT NULL,
      offset_ms INTEGER NOT NULL,
      uri TEXT NOT NULL,
      memo TEXT,
      compressed INTEGER NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_photos_insp ON photos(inspection_id, taken_at);
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS transcripts (
      inspection_id TEXT NOT NULL,
      chunk_start INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      text TEXT NOT NULL,
      segments TEXT NOT NULL,
      PRIMARY KEY (inspection_id, chunk_start)
    );
    CREATE TABLE IF NOT EXISTS reports (
      inspection_id TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

// ── settings ──
export function getSetting(key: string): string | null {
  const r = getDb().getFirstSync<{ value: string | null }>('SELECT value FROM settings WHERE key = ?', [key]);
  return r?.value ?? null;
}
export function setSetting(key: string, value: string): void {
  getDb().runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// ── inspections ──
export function createInspection(i: Inspection): void {
  getDb().runSync(
    'INSERT INTO inspections (id, site, started_at, ended_at, status, dir) VALUES (?, ?, ?, ?, ?, ?)',
    [i.id, i.site, i.started_at, i.ended_at, i.status, i.dir]
  );
}
export function getInspection(id: string): Inspection | null {
  return getDb().getFirstSync<Inspection>('SELECT * FROM inspections WHERE id = ?', [id]);
}
export function getActiveInspection(): Inspection | null {
  return getDb().getFirstSync<Inspection>(
    "SELECT * FROM inspections WHERE status = 'active' ORDER BY started_at DESC LIMIT 1"
  );
}
export function listInspections(): (Inspection & { photo_count: number })[] {
  return getDb().getAllSync<Inspection & { photo_count: number }>(
    `SELECT i.*, (SELECT COUNT(*) FROM photos p WHERE p.inspection_id = i.id) AS photo_count
     FROM inspections i ORDER BY started_at DESC LIMIT 100`
  );
}
export function endInspection(id: string, endedAt: number): void {
  getDb().runSync("UPDATE inspections SET status = 'ended', ended_at = ? WHERE id = ?", [endedAt, id]);
}
export function deleteInspectionRows(id: string): void {
  const d = getDb();
  d.withTransactionSync(() => {
    d.runSync('DELETE FROM photos WHERE inspection_id = ?', [id]);
    d.runSync('DELETE FROM transcripts WHERE inspection_id = ?', [id]);
    d.runSync('DELETE FROM reports WHERE inspection_id = ?', [id]);
    d.runSync('DELETE FROM inspections WHERE id = ?', [id]);
  });
}

// ── photos ──
export function insertPhoto(p: Photo): void {
  getDb().runSync(
    `INSERT INTO photos (id, inspection_id, taken_at, offset_ms, uri, memo, compressed, width, height)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.id, p.inspection_id, p.taken_at, p.offset_ms, p.uri, p.memo, p.compressed, p.width, p.height]
  );
}
export function listPhotos(inspectionId: string): Photo[] {
  return getDb().getAllSync<Photo>('SELECT * FROM photos WHERE inspection_id = ? ORDER BY taken_at ASC', [
    inspectionId,
  ]);
}
export function countPhotos(inspectionId: string): number {
  const r = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM photos WHERE inspection_id = ?', [
    inspectionId,
  ]);
  return r?.n ?? 0;
}
export function lastPhoto(inspectionId: string): Photo | null {
  return getDb().getFirstSync<Photo>(
    'SELECT * FROM photos WHERE inspection_id = ? ORDER BY taken_at DESC LIMIT 1',
    [inspectionId]
  );
}
export function setPhotoMemo(id: string, memo: string): void {
  getDb().runSync('UPDATE photos SET memo = ? WHERE id = ?', [memo.trim() || null, id]);
}
export function markPhotoCompressed(id: string, width: number, height: number): void {
  getDb().runSync('UPDATE photos SET compressed = 1, width = ?, height = ? WHERE id = ?', [width, height, id]);
}
export function listUncompressedPhotos(): Photo[] {
  return getDb().getAllSync<Photo>('SELECT * FROM photos WHERE compressed = 0 ORDER BY taken_at ASC');
}
export function deletePhotoRow(id: string): void {
  getDb().runSync('DELETE FROM photos WHERE id = ?', [id]);
}

// ── transcripts (2단계) ──
export function listTranscripts(inspectionId: string): Transcript[] {
  return getDb().getAllSync<Transcript>(
    'SELECT * FROM transcripts WHERE inspection_id = ? ORDER BY chunk_start ASC',
    [inspectionId]
  );
}
export function saveTranscript(t: Transcript): void {
  getDb().runSync(
    'INSERT OR REPLACE INTO transcripts (inspection_id, chunk_start, duration_ms, text, segments) VALUES (?, ?, ?, ?, ?)',
    [t.inspection_id, t.chunk_start, t.duration_ms, t.text, t.segments]
  );
}

// ── reports (2단계) ──
export function getReport(inspectionId: string): { content: string; updated_at: number } | null {
  return getDb().getFirstSync<{ content: string; updated_at: number }>(
    'SELECT content, updated_at FROM reports WHERE inspection_id = ?',
    [inspectionId]
  );
}
export function saveReport(inspectionId: string, content: string): void {
  getDb().runSync('INSERT OR REPLACE INTO reports (inspection_id, content, updated_at) VALUES (?, ?, ?)', [
    inspectionId,
    content,
    Date.now(),
  ]);
}

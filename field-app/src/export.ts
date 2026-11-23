import * as Sharing from 'expo-sharing';
import { File } from 'expo-file-system';
import FieldRecorder from '../modules/field-recorder';
import * as DB from './db';
import { loadReport } from './report';
import { exportsDir } from './storage';
import { flattenSegments, photoContext } from './transcribe';
import { fmtClock, fmtDate, fmtDuration, toNativePath } from './util';

function safe(s: string, max = 30): string {
  return s.replace(/[\\/:*?"<>|\n\r\t]+/g, ' ').replace(/\s+/g, '_').replace(/^_+|_+$/g, '').slice(0, max);
}

function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

function ymd(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** 다른 양식에 넣기 좋은 파일 이름: 03_143105_소화기_압력_미달.jpg */
export function photoFileName(index: number, p: DB.Photo): string {
  const memo = p.memo ? `_${safe(p.memo)}` : '';
  return `${String(index + 1).padStart(2, '0')}_${hhmm(p.taken_at)}${memo}.jpg`;
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 엑셀에서 바로 열리는 사진 목록(CSV, UTF-8 BOM) */
export function buildPhotoCsv(insp: DB.Inspection): string {
  const photos = DB.listPhotos(insp.id);
  const segs = flattenSegments(DB.listTranscripts(insp.id));
  const report = loadReport(insp.id);
  const head = ['번호', '파일명', '촬영일', '촬영시각', '점검 경과', '메모', '지적사항', '조치 필요사항', '담당', '기한', '촬영 전 대화', '촬영 후 대화'];
  const rows = photos.map((p, i) => {
    const items = (report?.items ?? []).filter((it) => it.photos.includes(i + 1));
    const ctx = segs.length ? photoContext(segs, p.taken_at) : null;
    return [
      String(i + 1),
      photoFileName(i, p),
      fmtDate(p.taken_at),
      fmtClock(p.taken_at),
      fmtDuration(p.offset_ms),
      p.memo ?? '',
      items.map((it) => it.finding).join(' / '),
      items.map((it) => it.action).join(' / '),
      items.map((it) => it.owner).join(' / '),
      items.map((it) => it.due).join(' / '),
      ctx?.before ?? '',
      ctx?.after ?? '',
    ];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** 사진 전체 + 사진목록.csv + 점검정보.txt 를 ZIP으로 묶어 공유 창을 띄운다 */
export async function exportPhotosZip(insp: DB.Inspection): Promise<void> {
  const photos = DB.listPhotos(insp.id);
  if (photos.length === 0) throw new Error('사진이 없습니다.');
  const report = loadReport(insp.id);
  const info = [
    `현장: ${insp.site}`,
    `점검일: ${fmtDate(insp.started_at)} ${fmtClock(insp.started_at)}${insp.ended_at ? ` ~ ${fmtClock(insp.ended_at)}` : ''}`,
    `사진: ${photos.length}장`,
    report?.summary ? `\n요약: ${report.summary}` : '',
    '',
    '파일 이름 = 번호_촬영시각(시분초)_메모.jpg',
    '사진목록.csv 는 엑셀로 열립니다 (메모·지적사항·조치·담당·기한·앞뒤 대화).',
  ].join('\n');
  const out = new File(exportsDir(insp), `점검사진_${safe(insp.site, 20)}_${ymd(insp.started_at)}.zip`);
  await FieldRecorder.zipFiles(
    photos.map((p) => toNativePath(p.uri)),
    photos.map((p, i) => `사진/${photoFileName(i, p)}`),
    ['사진목록.csv', '점검정보.txt'],
    [buildPhotoCsv(insp), '﻿' + info],
    toNativePath(out.uri)
  );
  await Sharing.shareAsync(out.uri, { mimeType: 'application/zip', dialogTitle: '사진 묶음 보내기' });
}

/** 갤러리 '사진/현장점검/<날짜_현장명>' 앨범에 모두 저장 */
export async function savePhotosToGallery(insp: DB.Inspection, only?: DB.Photo[]): Promise<number> {
  const all = DB.listPhotos(insp.id);
  const list = only ?? all;
  return FieldRecorder.saveToGallery(
    list.map((p) => toNativePath(p.uri)),
    list.map((p) => `${ymd(insp.started_at)}_${photoFileName(all.findIndex((x) => x.id === p.id), p)}`),
    `${ymd(insp.started_at)}_${safe(insp.site, 24)}`
  );
}

/** 사진 한 장 공유 (카톡·메일·드라이브 등) */
export async function sharePhoto(p: DB.Photo): Promise<void> {
  await Sharing.shareAsync(p.uri, { mimeType: 'image/jpeg', dialogTitle: '사진 보내기' });
}

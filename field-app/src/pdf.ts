import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as DB from './db';
import type { Report } from './report';
import { exportsDir } from './storage';
import { flattenSegments, photoContext } from './transcribe';
import { fmtClock, fmtDate, fmtDuration } from './util';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function photoDataUri(p: DB.Photo): Promise<string | null> {
  try {
    const ctx = ImageManipulator.manipulate(p.uri);
    ctx.resize((p.width ?? 0) >= (p.height ?? 0) ? { width: 1024, height: null } : { width: null, height: 1024 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.65, format: SaveFormat.JPEG, base64: true });
    return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
  } catch {
    return null;
  }
}

export async function buildPdf(
  insp: DB.Inspection,
  report: Report | null,
  onStatus: (s: string) => void
): Promise<string> {
  const photos = DB.listPhotos(insp.id);
  const segs = flattenSegments(DB.listTranscripts(insp.id));

  const rows = (report?.items ?? [])
    .map(
      (it, i) => `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(it.finding)}${it.photos.length ? `<div class="ref">사진 ${it.photos.join(', ')}</div>` : ''}</td>
        <td>${esc(it.action)}</td>
        <td class="c">${esc(it.owner)}</td>
        <td class="c">${esc(it.due)}</td>
      </tr>`
    )
    .join('');

  const photoHtml: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    onStatus(`PDF 사진 넣는 중… ${i + 1}/${photos.length}`);
    const p = photos[i];
    const src = await photoDataUri(p);
    const c = segs.length ? photoContext(segs, p.taken_at) : null;
    const related = (report?.items ?? [])
      .map((it, k) => (it.photos.includes(i + 1) ? `${k + 1}. ${it.finding}` : null))
      .filter(Boolean) as string[];
    photoHtml.push(`<div class="photo">
      <div class="ph">사진 ${i + 1} · ${fmtClock(p.taken_at)} (+${fmtDuration(p.offset_ms)})</div>
      ${src ? `<img src="${src}"/>` : '<div class="noimg">사진을 읽지 못함</div>'}
      ${p.memo ? `<div class="memo">메모: ${esc(p.memo)}</div>` : ''}
      ${related.length ? `<div class="rel">관련 지적: ${esc(related.join(' / '))}</div>` : ''}
      ${c ? `<div class="ctx"><b>촬영 전후 대화</b><br/>${esc(c.before || '-')}<br/>📷<br/>${esc(c.after || '-')}</div>` : ''}
    </div>`);
  }

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: A4; margin: 14mm 12mm; }
    body { font-family: sans-serif; color: #000; font-size: 11pt; }
    h1 { font-size: 18pt; margin: 0 0 4mm; }
    .meta { color: #333; margin-bottom: 4mm; }
    .sum { border: 1px solid #000; padding: 3mm; margin: 3mm 0 5mm; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #000; padding: 2mm; vertical-align: top; font-size: 10pt; }
    th { background: #e6e6e6; }
    td.c { text-align: center; white-space: nowrap; }
    .ref { color: #444; font-size: 9pt; margin-top: 1mm; }
    h2 { font-size: 14pt; margin: 7mm 0 3mm; }
    .photo { page-break-inside: avoid; margin-bottom: 6mm; border-top: 2px solid #000; padding-top: 2mm; }
    .ph { font-weight: bold; margin-bottom: 2mm; }
    .photo img { width: 100%; max-height: 150mm; object-fit: contain; }
    .memo { font-weight: bold; margin-top: 1mm; }
    .rel { margin-top: 1mm; }
    .ctx { margin-top: 2mm; font-size: 9.5pt; color: #222; background: #f3f3f3; padding: 2mm; }
    ul { margin: 0; padding-left: 5mm; }
  </style></head><body>
  <h1>${esc(report?.title || '현장 점검 보고서')}</h1>
  <div class="meta">현장: ${esc(insp.site)}<br/>일시: ${fmtDate(insp.started_at)} ${fmtClock(insp.started_at)}${
    insp.ended_at ? ` ~ ${fmtClock(insp.ended_at)}` : ''
  } · 사진 ${photos.length}장</div>
  ${report?.summary ? `<div class="sum">${esc(report.summary)}</div>` : ''}
  <h2>지적사항 및 조치 필요사항</h2>
  ${
    rows
      ? `<table><thead><tr><th>No</th><th>지적사항</th><th>조치 필요사항</th><th>담당</th><th>기한</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div>(보고서 초안이 없습니다)</div>'
  }
  ${report?.notes?.length ? `<h2>참고사항</h2><ul>${report.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  <h2>사진 타임라인</h2>
  ${photoHtml.join('')}
  </body></html>`;

  onStatus('PDF 만드는 중…');
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const safeSite = insp.site.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30);
  const d = new Date(insp.started_at);
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const dest = new File(exportsDir(insp), `점검보고서_${safeSite}_${stamp}.pdf`);
  if (dest.exists) dest.delete();
  new File(uri).move(dest);
  return dest.uri;
}

export async function sharePdf(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('이 기기에서는 공유를 사용할 수 없습니다.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: '점검 보고서 공유 (카카오톡·메일)' });
}

// 웹 미리보기(디자인 확인)용 가짜 데이터. 실제 앱은 db.ts(SQLite)를 씁니다.
import type { Inspection, Photo, Transcript } from './db';
export type { Inspection, Photo, Transcript } from './db';

const now = Date.now();
const H = 3600_000;
const ins: Inspection[] = [
  { id: 'demo-active', site: '101동 지하 2층 기계실', started_at: now - 23 * 60_000, ended_at: null, status: 'active', dir: '/d' },
  { id: 'demo1', site: '102동 3~5층 소방설비 점검', started_at: now - 3 * H, ended_at: now - 3 * H + 34 * 60_000, status: 'ended', dir: '/d' },
  { id: 'demo2', site: '지하주차장 B1 스프링클러', started_at: now - 26 * H, ended_at: now - 26 * H + 52 * 60_000, status: 'ended', dir: '/d' },
  { id: 'demo3', site: '근린생활시설 화기작업 구역', started_at: now - 74 * H, ended_at: now - 74 * H + 18 * 60_000, status: 'ended', dir: '/d' },
];
const memos = ['소화기 압력 게이지 적색 — 교체', null, '유도등 점등 불량', '방화문 도어클로저 고장', null, '감지기 덮개 미제거'];
const photos: Photo[] = Array.from({ length: 6 }, (_, i) => ({
  id: `p${i}`,
  inspection_id: 'demo1',
  taken_at: ins[1].started_at + (2 + i * 5) * 60_000 + 17_000,
  offset_ms: (2 + i * 5) * 60_000 + 17_000,
  uri: `/preview/p${(i % 4) + 1}.jpg`,
  memo: memos[i],
  compressed: 1,
  width: 1920,
  height: 1440,
}));
const transcripts: Transcript[] = [];
const lines = [
  '여기 소화기 압력이 빨간색으로 넘어가 있네요. 이거 오늘 중으로 교체해 주세요.',
  '네 알겠습니다. 설비팀 김 반장님께 전달하겠습니다.',
  '유도등도 하나 안 들어오는데 배터리 확인해 보시고요.',
  '방화문 닫히는 게 너무 느려요, 도어클로저 조정 필요합니다. 금주 금요일까지.',
];
for (let i = 0; i < 34; i++) {
  const st = ins[1].started_at + i * 60_000;
  transcripts.push({
    inspection_id: 'demo1',
    chunk_start: st,
    duration_ms: 59_800,
    text: lines[i % lines.length],
    segments: JSON.stringify([{ start: 5, end: 14, text: lines[i % lines.length] }, { start: 30, end: 40, text: lines[(i + 1) % lines.length] }]),
  });
}
const settings: Record<string, string> = { setupDone: '1', lastSite: '102동 3~5층 소방설비 점검' };
const reports: Record<string, { content: string; updated_at: number }> = {
  demo1: {
    updated_at: now,
    content: JSON.stringify({
      title: '102동 소방설비 정기 점검 보고서',
      summary: '102동 3~5층 소방설비를 점검한 결과 소화기·유도등·방화문 등 4건의 지적사항이 확인되었다. 금주 내 조치 후 결과 보고 필요.',
      items: [
        { photos: [1], finding: '3층 복도 소화기 압력 게이지 적색(압력 미달)', action: '소화기 교체 및 주변 소화기 일괄 점검할 것', owner: '설비팀 김 반장', due: '금일', evidence: '소화기 압력이 빨간색으로 넘어가 있네요' },
        { photos: [3], finding: '4층 계단실 피난구유도등 미점등', action: '예비전원(배터리) 확인 후 교체', owner: '전기팀', due: '11/28', evidence: '유도등도 하나 안 들어오는데' },
        { photos: [4], finding: '5층 방화문 도어클로저 작동 불량(자동 폐쇄 지연)', action: '도어클로저 조정 또는 교체', owner: '미정', due: '금요일', evidence: '닫히는 게 너무 느려요' },
      ],
      notes: ['다음 점검 시 지하층 스프링클러 헤드 도장 여부 확인'],
    }),
  },
};

export const getDb = () => ({});
export const getSetting = (k: string) => settings[k] ?? null;
export const setSetting = (k: string, v: string) => void (settings[k] = v);
export const createInspection = (i: Inspection) => void ins.unshift(i);
export const getInspection = (id: string) => ins.find((i) => i.id === id) ?? null;
export const getActiveInspection = () => null;
export const listInspections = () =>
  ins.map((i) => ({ ...i, photo_count: i.id === 'demo1' ? photos.length : i.id === 'demo-active' ? 9 : 21 }));
export const endInspection = () => {};
export const deleteInspectionRows = () => {};
export const insertPhoto = (p: Photo) => void photos.push(p);
export const listPhotos = (id: string) => photos.filter((p) => p.inspection_id === id || id === 'demo-active');
export const countPhotos = (id: string) => (id === 'demo-active' ? 9 : photos.length);
export const lastPhoto = () => photos[0];
export const setPhotoMemo = () => {};
export const markPhotoCompressed = () => {};
export const listUncompressedPhotos = () => [] as Photo[];
export const deletePhotoRow = () => {};
export const listTranscripts = (id: string) => (id === 'demo1' ? transcripts : []);
export const saveTranscript = () => {};
export const getReport = (id: string) => reports[id] ?? null;
export const saveReport = (id: string, content: string) => void (reports[id] = { content, updated_at: Date.now() });

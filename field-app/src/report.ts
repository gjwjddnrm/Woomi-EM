import Anthropic from '@anthropic-ai/sdk';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as DB from './db';
import { getEngine, getKey } from './keys';
import { geminiGenerate, parseJsonLoose } from './gemini';
import { flattenSegments, photoContext } from './transcribe';
import { fmtClock, fmtDate, fmtDuration } from './util';

export type ReportItem = {
  photos: number[]; // 사진 번호(1부터)
  finding: string; // 지적사항
  action: string; // 조치 필요사항
  owner: string; // 담당
  due: string; // 기한
  evidence: string; // 근거가 된 대화 한 줄
};

export type Report = {
  title: string;
  summary: string;
  items: ReportItem[];
  notes: string[];
};

const MODEL = 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          photos: { type: 'array', items: { type: 'integer' } },
          finding: { type: 'string' },
          action: { type: 'string' },
          owner: { type: 'string' },
          due: { type: 'string' },
          evidence: { type: 'string' },
        },
        required: ['photos', 'finding', 'action', 'owner', 'due', 'evidence'],
        additionalProperties: false,
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'items', 'notes'],
  additionalProperties: false,
};

const SYSTEM = `당신은 건설 현장 소방·안전 점검 보고서를 정리하는 담당자입니다.
점검자(상사)와 동행자의 현장 대화 녹취와, 대화 중 찍은 사진(번호·시각·메모)을 받습니다.
녹취는 자동 음성 인식이라 틀린 글자가 있을 수 있으니 문맥으로 바로잡되, 대화에 없는 내용은 지어내지 마세요.

해야 할 일: 지시·지적이 나온 지점마다 하나의 항목으로 정리합니다.
- finding(지적사항): 무엇이 어떤 상태인지. 위치가 언급되면 포함.
- action(조치 필요사항): 무엇을 해야 하는지 구체적으로.
- owner(담당): 대화에서 정해진 사람·업체·공종. 언급이 없으면 "미정".
- due(기한): 대화에서 정해진 기한(예: "금일", "11/30까지"). 없으면 "미정".
- photos: 그 지적과 관련된 사진 번호. 촬영 시각 앞뒤 대화를 보고 연결하세요. 없으면 빈 배열.
- evidence: 근거가 된 대화를 짧게 인용.
같은 내용이 반복되면 하나로 합치고, 잡담·이동 중 대화는 빼세요.
summary는 점검 전체를 2~3문장으로, notes는 항목으로 만들기 어려운 참고사항(없으면 빈 배열)입니다.
모든 글은 한국어, 보고서 문체("~할 것", "~확인 필요")로 간결하게 씁니다.`;

async function photoBase64(p: DB.Photo): Promise<string | null> {
  try {
    const ctx = ImageManipulator.manipulate(p.uri);
    ctx.resize((p.width ?? 0) >= (p.height ?? 0) ? { width: 800, height: null } : { width: null, height: 800 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return out.base64 ?? null;
  } catch {
    return null;
  }
}

type Block = { type: 'text'; text: string } | { type: 'image'; data: string };

const GEMINI_FORMAT = `
답은 아래 형식의 JSON 하나만 출력하세요(설명·코드블록 없이):
{"title": "보고서 제목", "summary": "요약 2~3문장", "items": [{"photos": [사진번호 정수], "finding": "지적사항", "action": "조치 필요사항", "owner": "담당", "due": "기한", "evidence": "근거 대화 인용"}], "notes": ["참고사항"]}`;

export async function generateReport(insp: DB.Inspection, onStatus: (s: string) => void): Promise<Report> {
  const engine = getEngine();
  const key = await getKey(engine === 'gemini' ? 'gemini' : 'anthropic');
  if (!key)
    throw new Error(engine === 'gemini' ? '설정에서 Gemini API 키를 먼저 입력하세요.' : '설정에서 Claude(Anthropic) API 키를 먼저 입력하세요.');
  const photos = DB.listPhotos(insp.id);
  const ts = DB.listTranscripts(insp.id);
  const segs = flattenSegments(ts);
  if (segs.length === 0 && photos.every((p) => !p.memo)) {
    throw new Error('먼저 "음성 → 텍스트 변환"을 해 주세요. 정리할 대화가 없습니다.');
  }

  // 1) 녹취 (시각 포함)
  const transcript = segs.map((s) => `[${fmtClock(s.start)}] ${s.text}`).join('\n');

  // 2) 사진 목록 + 사진별 앞뒤 대화
  onStatus('사진 준비 중…');
  const content: Block[] = [];
  content.push({
    type: 'text',
    text:
      `현장명: ${insp.site}\n점검일: ${fmtDate(insp.started_at)} ${fmtClock(insp.started_at)}` +
      (insp.ended_at ? ` ~ ${fmtClock(insp.ended_at)} (${fmtDuration(insp.ended_at - insp.started_at)})` : '') +
      `\n사진 ${photos.length}장\n\n<녹취>\n${transcript || '(녹취 없음)'}\n</녹취>`,
  });
  const MAX_IMAGES = 40;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const c = segs.length ? photoContext(segs, p.taken_at) : null;
    content.push({
      type: 'text',
      text:
        `사진 ${i + 1} — ${fmtClock(p.taken_at)} (점검 시작 후 ${fmtDuration(p.offset_ms)})` +
        (p.memo ? `\n메모: ${p.memo}` : '') +
        (c ? `\n촬영 전 대화: ${c.before || '-'}\n촬영 후 대화: ${c.after || '-'}` : ''),
    });
    if (i < MAX_IMAGES) {
      onStatus(`사진 준비 중… ${i + 1}/${photos.length}`);
      const b = await photoBase64(p);
      if (b) content.push({ type: 'image', data: b });
    }
  }
  content.push({ type: 'text', text: '위 자료로 점검 보고서 초안을 만들어 주세요.' });

  let parsed: Report;
  if (engine === 'gemini') {
    onStatus('Gemini가 보고서 초안을 쓰는 중… (1~3분)');
    const text = await geminiGenerate(
      key,
      content.map((b) => (b.type === 'text' ? { text: b.text } : { inlineData: { mimeType: 'image/jpeg', data: b.data } })),
      { system: SYSTEM + GEMINI_FORMAT, timeoutMs: 300_000, onWait: (sec) => onStatus(`무료 사용량 제한 — ${sec}초 기다리는 중…`) }
    );
    parsed = parseJsonLoose<Report>(text);
  } else {
    parsed = await claudeReport(key, content, onStatus);
  }
  parsed.items = (parsed.items ?? []).map((it) => ({
    photos: (it.photos ?? []).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= photos.length),
    finding: it.finding ?? '',
    action: it.action ?? '',
    owner: it.owner || '미정',
    due: it.due || '미정',
    evidence: it.evidence ?? '',
  }));
  parsed.notes = parsed.notes ?? [];
  parsed.title = parsed.title || '현장 점검 보고서';
  parsed.summary = parsed.summary ?? '';
  DB.saveReport(insp.id, JSON.stringify(parsed));
  return parsed;
}

export function loadReport(inspectionId: string): Report | null {
  const r = DB.getReport(inspectionId);
  if (!r) return null;
  try {
    return JSON.parse(r.content) as Report;
  } catch {
    return null;
  }
}

export function saveReportEdits(inspectionId: string, r: Report): void {
  DB.saveReport(inspectionId, JSON.stringify(r));
}

async function claudeReport(key: string, blocks: Block[], onStatus: (s: string) => void): Promise<Report> {
  onStatus('Claude가 보고서 초안을 쓰는 중… (1~3분)');
  const content: Anthropic.Beta.BetaContentBlockParam[] = blocks.map((b) =>
    b.type === 'text'
      ? { type: 'text', text: b.text }
      : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b.data } }
  );
  const client = new Anthropic({ apiKey: key, timeout: 10 * 60 * 1000, maxRetries: 2 });
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Claude API 키가 올바르지 않습니다. 설정에서 확인하세요.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도하세요.');
    if (e instanceof Anthropic.BadRequestError) throw new Error(`요청 오류: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new Error('인터넷 연결을 확인하세요.');
    throw e;
  }
  if (res.stop_reason === 'refusal') throw new Error('Claude가 이 요청을 처리하지 않았습니다. 내용을 확인해 주세요.');
  if (res.stop_reason === 'max_tokens') throw new Error('보고서가 너무 길어 중간에 끊겼습니다. 다시 시도해 주세요.');
  const text = res.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  try {
    return JSON.parse(text) as Report;
  } catch {
    throw new Error('보고서 형식을 읽지 못했습니다. 다시 시도해 주세요.');
  }
}

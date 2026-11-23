import * as DB from './db';

// Google Gemini API (AI Studio 키). 모델 이름은 자주 바뀌므로 키로 목록을 조회해 최신 Flash 모델을 고른다.
const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const FALLBACK_MODEL = 'models/gemini-2.5-flash';
const MODEL_TTL = 24 * 3600_000;

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

type ApiError = Error & { status?: number };

function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) + Number(m[2] ?? 0) / 10 : 0;
}

export async function pickModel(key: string, force = false): Promise<string> {
  const cached = DB.getSetting('geminiModel');
  const at = Number(DB.getSetting('geminiModelAt') ?? 0);
  if (!force && cached && Date.now() - at < MODEL_TTL) return cached;
  try {
    const res = await fetch(`${BASE}/models?pageSize=1000`, { headers: { 'x-goog-api-key': key } });
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw Object.assign(new Error('Gemini API 키가 올바르지 않습니다. 설정에서 확인하세요.'), { status: res.status });
    }
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const usable = (j.models ?? []).filter(
      (m) => /gemini/.test(m.name) && /flash/.test(m.name) && (m.supportedGenerationMethods ?? []).includes('generateContent')
    );
    const stable = usable.filter((m) => !/(lite|image|tts|live|audio|thinking|exp|preview|embedding|8b|latest)/.test(m.name));
    const pool = (stable.length ? stable : usable).sort((a, b) => versionOf(b.name) - versionOf(a.name));
    const chosen = pool[0]?.name ?? FALLBACK_MODEL;
    DB.setSetting('geminiModel', chosen);
    DB.setSetting('geminiModelAt', String(Date.now()));
    return chosen;
  } catch (e) {
    if ((e as ApiError).status) throw e;
    return cached ?? FALLBACK_MODEL;
  }
}

function retryDelayMs(body: string): number {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(90_000, Math.ceil(Number(m[1]) * 1000) + 1000) : 30_000;
}

/** generateContent 한 번. JSON 응답 텍스트를 돌려준다. 429(사용량)는 기다렸다 다시 시도. */
export async function geminiGenerate(
  key: string,
  parts: GeminiPart[],
  opts: { system?: string; timeoutMs?: number; onWait?: (sec: number) => void } = {}
): Promise<string> {
  let model = await pickModel(key);
  let modelRetried = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 180_000);
    let res: Response;
    let body: string;
    try {
      res = await fetch(`${BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
        signal: ctrl.signal,
      });
      body = await res.text();
    } catch (e) {
      clearTimeout(timer);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw new Error('인터넷 연결을 확인하세요.');
    }
    clearTimeout(timer);

    if (res.status === 429 || res.status === 503 || res.status === 500) {
      const wait = res.status === 429 ? retryDelayMs(body) : 5000 * (attempt + 1);
      if (/per day|PerDay|daily/i.test(body) && res.status === 429) {
        throw new Error('오늘 Gemini 무료 사용량을 다 썼습니다. 내일 다시 하거나, 남은 부분은 내일 이어서 하세요.');
      }
      opts.onWait?.(Math.round(wait / 1000));
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (res.status === 404 && !modelRetried) {
      modelRetried = true;
      model = await pickModel(key, true);
      continue;
    }
    if (!res.ok) {
      let msg = body;
      try {
        msg = JSON.parse(body)?.error?.message ?? body;
      } catch {}
      if (res.status === 400 && /API key/i.test(msg)) throw new Error('Gemini API 키가 올바르지 않습니다. 설정에서 확인하세요.');
      if (res.status === 403) throw new Error('Gemini API 키 권한이 없습니다. 설정에서 키를 확인하세요.');
      throw Object.assign(new Error(`Gemini 오류 ${res.status}: ${String(msg).slice(0, 200)}`), { status: res.status });
    }
    const j = JSON.parse(body) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (j.promptFeedback?.blockReason) throw new Error(`Gemini가 처리하지 않았습니다 (${j.promptFeedback.blockReason}).`);
    const c = j.candidates?.[0];
    const text = (c?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text) throw new Error(`Gemini 응답이 비어 있습니다 (${c?.finishReason ?? '알 수 없음'}).`);
    return text;
  }
  throw new Error('Gemini 사용량 제한으로 계속 실패했습니다. 잠시 뒤 다시 시도하세요.');
}

/** ```json ... ``` 같은 감싸기가 있어도 JSON을 꺼낸다 */
export function parseJsonLoose<T>(text: string): T {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(t) as T;
  } catch {
    const a = Math.min(...['{', '['].map((ch) => (t.indexOf(ch) < 0 ? Infinity : t.indexOf(ch))));
    const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a !== Infinity && b > a) return JSON.parse(t.slice(a, b + 1)) as T;
    throw new Error('응답 형식을 읽지 못했습니다.');
  }
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 1234567ms → "20:34" / "1:02:03" */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return (h > 0 ? `${h}:` : '') + `${mm}:${String(s).padStart(2, '0')}`;
}

export function fmtClock(epochMs: number): string {
  const d = new Date(epochMs);
  const h = d.getHours();
  const ap = h < 12 ? '오전' : '오후';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function fmtDate(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtBytes(b: number): string {
  if (b < 0) return '알 수 없음';
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1)}GB`;
  return `${Math.round(b / 1024 ** 2)}MB`;
}

/** file:///data/... → /data/... (네이티브 모듈용) */
export function toNativePath(uri: string): string {
  let p = uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
  try {
    p = decodeURIComponent(p);
  } catch {}
  return p.endsWith('/') ? p.slice(0, -1) : p;
}

export function toFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

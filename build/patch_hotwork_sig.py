# 화기작업(별지 7·8) 서명이 희미하게 나오는 문제:
# 사진·PDF에서 오려낸 서명은 반투명 픽셀이 많아서 흐리게 보임 →
# 서식에 넣기 직전에 서명을 진하게(투명도 보정) + 살짝 굵게(1~2px) 만들어 넣습니다.
# 이미 저장된 기록의 서명도 화면·인쇄 때 자동으로 보정됩니다(원본 저장값은 그대로).

SIG_HELPER = r"""
// ---- 서명 진하게 보정 (WOOMI) ----
const SIGX = new Map();          // 원본 서명 → 보정된 서명
function sigBoostCanvas(cv){
  const W = cv.width, H = cv.height; if(!W || !H) return null;
  const x = cv.getContext("2d"), id = x.getImageData(0, 0, W, H), d = id.data, N = W * H;
  const a = new Uint8ClampedArray(N); let trans = 0;
  for(let i = 0; i < N; i++){ a[i] = d[i * 4 + 3]; if(a[i] < 250) trans++; }
  if(trans < N * 0.05) return null;                      // 투명 배경 서명이 아니면 손대지 않음
  const r = Math.max(1, Math.round(Math.max(W, H) / 220)), t = new Uint8ClampedArray(N), b = new Uint8ClampedArray(N);
  for(let y = 0; y < H; y++) for(let xx = 0; xx < W; xx++){ let m = 0; for(let k = -r; k <= r; k++){ const v = a[y * W + Math.min(W - 1, Math.max(0, xx + k))]; if(v > m) m = v; } t[y * W + xx] = m; }
  for(let y = 0; y < H; y++) for(let xx = 0; xx < W; xx++){ let m = 0; for(let k = -r; k <= r; k++){ const v = t[Math.min(H - 1, Math.max(0, y + k)) * W + xx]; if(v > m) m = v; } b[y * W + xx] = m; }
  for(let i = 0; i < N; i++){
    const v = b[i] < 14 ? 0 : Math.min(255, Math.round(Math.pow(b[i] / 255, 0.4) * 1.5 * 255));
    d[i * 4] = 12; d[i * 4 + 1] = 14; d[i * 4 + 2] = 40; d[i * 4 + 3] = v;
  }
  x.putImageData(id, 0, 0);
  return cv;
}
function sigBoostUrl(u){
  return new Promise(res => {
    const im = new Image();
    im.onload = ()=>{ try{ const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); const o = sigBoostCanvas(c); res(o ? o.toDataURL("image/png") : u); }catch(e){ res(u); } };
    im.onerror = ()=> res(u); im.src = u;
  });
}
let sigxTimer = 0;
function SIGSRC(u){
  if(!u || typeof u !== "string" || u.indexOf("data:image/") !== 0) return u;
  const v = SIGX.get(u); if(v) return v === 1 ? u : v;
  SIGX.set(u, 1);
  sigBoostUrl(u).then(o => { SIGX.set(u, o); clearTimeout(sigxTimer); sigxTimer = setTimeout(()=>{ try{ render(); }catch(e){} }, 30); });
  return u;
}
// 저장된 기록의 서명을 미리 보정해 둡니다 (인쇄·PDF 때 바로 진하게 나오도록)
function sigPrewarm(obj){
  const seen = new Set();
  (function walk(v){ if(!v) return; if(typeof v === "string"){ if(v.indexOf("data:image/png") === 0 && !seen.has(v)){ seen.add(v); SIGSRC(v); } return; }
    if(typeof v === "object") for(const k in v) walk(v[k]); })(obj);
}
"""

PAIRS = [
    # 서식에 들어가는 서명 그림을 보정본으로
    ('const im = (dx, dy)=> `<img class="sgi" src="${d[key]}"',
     'const im = (dx, dy)=> `<img class="sgi" src="${SIGSRC(d[key])}"'),
    # 보정 함수 추가 (SG 정의 바로 앞)
    ('// 서명이 있으면 "(서명)" 글자는 숨기고(자리는 유지), 서명을 크게·진하게(같은 그림을 살짝 겹쳐서) 넣습니다.\n',
     SIG_HELPER + '// 서명이 있으면 "(서명)" 글자는 숨기고(자리는 유지), 서명을 크게·진하게(같은 그림을 살짝 겹쳐서) 넣습니다.\n'),
    # 저장된 기록을 불러오면 서명 미리 보정
    ('idbGet("entries").then(v => { if(Array.isArray(v)) entries = v;',
     'idbGet("entries").then(v => { if(Array.isArray(v)) entries = v; try{ sigPrewarm(entries); sigPrewarm(defMgrSig()); }catch(e){}'),
]

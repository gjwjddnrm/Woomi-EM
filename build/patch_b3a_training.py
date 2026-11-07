# 별지 3-1: 비상대비훈련 실시 보고서(스캔본 PDF) 불러오기
# - "🚒 훈련 보고서(스캔본)로 읽기" 버튼: 보고서 쪽에서 일자·실참석·출역인원·문제점·개선사항,
#   사진대지 쪽에서 사진, 참석확인서 쪽에서 소속·성명·서명을 손글씨 그대로 그림으로 오려 옵니다.
# - 구분은 기본으로 "훈련 > 화재 시 대피훈련 + 초기대응체계 기본 훈련"
# - 별지 3-2 이수자 명단은 소속·성명이 글자 대신 그림(orgImg·nameImg)이어도 표시·저장되게 확장

TRAIN_BTN_OLD = '<button type="button" class="reset-btn" id="b3a-ocr-start-btn" style="margin-top:8px">📄 PDF에서 자동 채우기</button>'
TRAIN_BTN_NEW = (TRAIN_BTN_OLD +
    '\n      <button type="button" class="reset-btn" id="b3a-tr-start-btn" style="margin-top:6px">🚒 훈련 보고서(스캔본)로 읽기</button>'
    '\n      <p class="save-note" style="margin:4px 0 0">비상대비훈련 실시 보고서·사진대지·참석확인서가 담긴 PDF는 이 버튼으로 읽어요. 참석자 소속·이름·서명은 손글씨 그대로 그림으로 들어가요.</p>')

TRAIN_REVIEW_OLD = '<div class="field"><label for="b3a-ocr-r-trade">대상 공종(협력업체)</label><input type="text" id="b3a-ocr-r-trade" /></div>'
TRAIN_REVIEW_NEW = TRAIN_REVIEW_OLD + '''
        <div id="b3a-tr-extra" style="display:none">
          <div class="field"><label for="b3a-ocr-r-done">실시 근로자수 (실참석)</label><input type="number" id="b3a-ocr-r-done" /></div>
          <div class="field"><label for="b3a-ocr-r-lack">미비점 (보고서의 문제점)</label><textarea id="b3a-ocr-r-lack" rows="3"></textarea></div>
          <div class="field"><label for="b3a-ocr-r-improve">개선사항</label><textarea id="b3a-ocr-r-improve" rows="4"></textarea></div>
          <p class="save-note" style="margin:4px 0 0">🚒 훈련 보고서: 구분은 <b>화재 시 대피훈련 + 초기대응체계 기본 훈련</b>으로 들어가요. 스캔본이라 글자를 잘못 읽은 곳이 있으면 여기서 고쳐 주세요.</p>
        </div>'''

TRAIN_CSS = """
  .pv-name-img{ max-height:7mm; max-width:100%; vertical-align:middle; }
  .b3b-row .b3b-img-thumb{ height:26px; max-width:70px; border:1px solid var(--line,#ccc); border-radius:4px; background:#fff; object-fit:contain; }
"""

TRAIN_JS = r"""
  /* ================= WOOMI: 비상대비훈련 보고서(스캔본) 불러오기 ================= */
  async function b3aTrOcr(canvas, psm, withBlocks){
    await b3aOcrWorker.setParameters({ tessedit_pageseg_mode: String(psm || 6) });
    try{
      const r = withBlocks ? await b3aOcrWorker.recognize(canvas, {}, { text: true, blocks: true }) : await b3aOcrWorker.recognize(canvas);
      return r.data || {};
    }finally{ await b3aOcrWorker.setParameters({ tessedit_pageseg_mode: "7" }); }
  }
  async function b3aTrRender(pdf, n, scale){
    const pg = await pdf.getPage(n), vp = pg.getViewport({ scale });
    const c = document.createElement("canvas"); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    return c;
  }
  function b3aTrSub(c, x0, y0, x1, y1){
    x0 = Math.max(0, Math.round(x0)); y0 = Math.max(0, Math.round(y0)); x1 = Math.min(c.width, Math.round(x1)); y1 = Math.min(c.height, Math.round(y1));
    const o = document.createElement("canvas"); o.width = Math.max(1, x1 - x0); o.height = Math.max(1, y1 - y0);
    o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return o;
  }
  // 형광펜·색 배경은 지우고 글씨만 남긴 회색 그림 (R·G·B 중 가장 밝은 값 기준)
  function b3aTrClean(c){
    const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
    const x = o.getContext("2d"); x.drawImage(c, 0, 0);
    const id = x.getImageData(0, 0, o.width, o.height), d = id.data;
    for(let i = 0; i < d.length; i += 4){ const v = Math.max(d[i], d[i+1], d[i+2]); d[i] = d[i+1] = d[i+2] = v; }
    x.putImageData(id, 0, 0); return o;
  }
  function b3aTrDark(c, th){
    const W = c.width, H = c.height, d = c.getContext("2d").getImageData(0, 0, W, H).data, m = new Uint8Array(W * H);
    for(let i = 0; i < W * H; i++) m[i] = Math.max(d[i*4], d[i*4+1], d[i*4+2]) < th ? 1 : 0;
    return { W, H, m };
  }
  function b3aTrGroup(arr, gap){
    const g = []; arr.forEach(v => { const L = g[g.length - 1]; if(L && v - L[L.length - 1] <= gap) L.push(v); else g.push([v]); });
    return g.map(a => Math.round(a.reduce((s, v)=> s + v, 0) / a.length));
  }
  function b3aTrNoSpace(t){ return String(t || "").replace(/\s+/g, ""); }

  // 손글씨 칸 → 배경이 투명한 글씨 그림 (형광펜 색은 지움)
  function b3aTrInk(cell){
    const W = cell.width, H = cell.height, x = cell.getContext("2d"), d = x.getImageData(0, 0, W, H).data, N = W * H;
    const lum = new Float32Array(N); for(let i = 0; i < N; i++) lum[i] = Math.max(d[i*4], d[i*4+1], d[i*4+2]);
    const s = Float32Array.from(lum).sort(), bg = s[Math.floor(N * 0.9)], ink = s[Math.floor(N * 0.01)];
    if(bg - ink < 60) return null;
    const lo = ink + (bg - ink) * 0.45, hi = bg - (bg - ink) * 0.18, a = new Uint8ClampedArray(N);
    let x0 = W, y0 = H, x1 = -1, y1 = -1, cnt = 0;
    for(let i = 0; i < N; i++){
      a[i] = Math.round(Math.pow(Math.max(0, Math.min(1, (hi - lum[i]) / (hi - lo))), 0.6) * 255);
      if(a[i] > 110){ cnt++; const yy = (i / W) | 0, xx = i - yy * W; if(xx < x0) x0 = xx; if(xx > x1) x1 = xx; if(yy < y0) y0 = yy; if(yy > y1) y1 = yy; }
    }
    if(cnt < N * 0.003 || x1 < 0) return null;
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(W - 1, x1 + 2); y1 = Math.min(H - 1, y1 + 2);
    const o = document.createElement("canvas"); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    const ox = o.getContext("2d"), oi = ox.createImageData(o.width, o.height);
    for(let yy = y0; yy <= y1; yy++) for(let xx = x0; xx <= x1; xx++){
      const si = yy * W + xx, t = ((yy - y0) * o.width + (xx - x0)) * 4;
      const k = Math.min(1, lum[si] / 255);   // 글씨 색은 살리되 조금 더 진하게
      oi.data[t] = d[si*4] * k; oi.data[t+1] = d[si*4+1] * k; oi.data[t+2] = d[si*4+2] * k; oi.data[t+3] = a[si];
    }
    ox.putImageData(oi, 0, 0);
    return { url: o.toDataURL("image/png"), w: x1 - x0 + 1, cellW: W, canvas: cell };
  }


  // 스캔한 사진대지에서 사진만 찾기 (표 선·회색 머리글·글자는 제외)
  //  - 반 해상도에서: 밝지 않은 픽셀 중 "색 없고 평평한 회색 면"을 빼고 → 얇은 선·글자는 열기(opening)로 지움
  //  - 덩어리마다 상자 → 겹치는 상자 합치기 → 가운데를 가로·세로로 꿰뚫는 직선이 있으면 두 장으로 나눔
  function b3aTrFindPhotos(c){
    const S = 2, W = Math.floor(c.width / S), H = Math.floor(c.height / S);
    const sm = document.createElement("canvas"); sm.width = W; sm.height = H; sm.getContext("2d").drawImage(c, 0, 0, W, H);
    const d = sm.getContext("2d").getImageData(0, 0, W, H).data, N = W * H;
    const lum = new Float32Array(N), sat = new Float32Array(N);
    for(let i = 0; i < N; i++){ const r = d[i*4], g = d[i*4+1], b = d[i*4+2]; lum[i] = (r + g + b) / 3; sat[i] = Math.max(r, g, b) - Math.min(r, g, b); }
    const integ = (f)=>{ const I = new Float64Array((W + 1) * (H + 1)); for(let y = 0; y < H; y++){ let run = 0; for(let x = 0; x < W; x++){ run += f(y * W + x); I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + run; } } return I; };
    const boxSum = (I, x, y, r)=>{ const x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(W, x + r + 1), y1 = Math.min(H, y + r + 1);
      return [I[y1 * (W + 1) + x1] - I[y0 * (W + 1) + x1] - I[y1 * (W + 1) + x0] + I[y0 * (W + 1) + x0], (x1 - x0) * (y1 - y0)]; };
    const IL = integ(i => lum[i]), IL2 = integ(i => lum[i] * lum[i]), IS = integ(i => sat[i]);
    let flat = new Uint8Array(N);
    for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
      const [s1, n] = boxSum(IL, x, y, 2), [s2] = boxSum(IL2, x, y, 2), [ss] = boxSum(IS, x, y, 2);
      const mean = s1 / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean)), i = y * W + x;
      flat[i] = (ss / n < 7 && sd < 7 && lum[i] > 90) ? 1 : 0;
    }
    const morph = (m, r, erode)=>{   // 정사각형 침식/팽창
      const I = integ(i => m[i]), o = new Uint8Array(N);
      for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){ const [sum, n] = boxSum(I, x, y, r); o[y * W + x] = erode ? (sum === n && n === (2 * r + 1) * (2 * r + 1) ? 1 : 0) : (sum > 0 ? 1 : 0); }
      return o;
    };
    flat = morph(morph(flat, 2, true), 2, false);
    let m = new Uint8Array(N);
    for(let i = 0; i < N; i++) m[i] = (lum[i] < 238 && !flat[i]) ? 1 : 0;
    m = morph(morph(m, 3, true), 3, false);   // 열기: 얇은 선·글자 지우기
    m = morph(morph(m, 1, false), 1, true);   // 닫기: 작은 틈 메우기
    // 덩어리 상자
    const lab = new Int32Array(N), boxes = [], st = [];
    for(let i = 0; i < N; i++){
      if(!m[i] || lab[i]) continue;
      const id = boxes.length + 1; let x0 = W, y0 = H, x1 = 0, y1 = 0; lab[i] = id; st.push(i);
      while(st.length){ const p = st.pop(), py = (p / W) | 0, px = p - py * W;
        if(px < x0) x0 = px; if(px > x1) x1 = px; if(py < y0) y0 = py; if(py > y1) y1 = py;
        for(const q of [p - 1, p + 1, p - W, p + W]){ if(q < 0 || q >= N) continue; if((q === p - 1 && px === 0) || (q === p + 1 && px === W - 1)) continue; if(m[q] && !lab[q]){ lab[q] = id; st.push(q); } } }
      boxes.push([x0, y0, x1 + 1, y1 + 1]);
    }
    let bx = boxes.filter(b => (b[2] - b[0]) * (b[3] - b[1]) > N * 0.002);
    for(let changed = true; changed;){
      changed = false;
      outer: for(let i = 0; i < bx.length; i++) for(let j = i + 1; j < bx.length; j++){
        const a = bx[i], b = bx[j];
        if(a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]){ bx[i] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]; bx.splice(j, 1); changed = true; break outer; }
      }
    }
    bx = bx.filter(b => b[2] - b[0] > W * 0.12 && b[3] - b[1] > H * 0.06);
    // 가운데를 꿰뚫는 직선(표 선)으로 나누기
    const darkLine = (b, horiz)=>{
      const [x0, y0, x1, y1] = b, L = horiz ? (y1 - y0) : (x1 - x0), a0 = Math.round(L * 0.3), a1 = Math.round(L * 0.7);
      let best = -1, bf = 0;
      for(let k = a0; k < a1; k++){
        let n = 0, tot = 0;
        // 표 선(어두운 직선)이나 흰 틈이 한 줄을 거의 다 차지하면 경계 후보 (가운데에 가까울수록 우선)
        if(horiz){ const y = y0 + k; for(let x = x0; x < x1; x++){ tot++; const v = lum[y * W + x]; if(v < 170 || v > 236) n++; } }
        else { const x = x0 + k; for(let y = y0; y < y1; y++){ tot++; const v = lum[y * W + x]; if(v < 170 || v > 236) n++; } }
        const f = n / tot - Math.abs(k - L / 2) / L * 0.05;
        if(f > bf){ bf = f; best = k; }
      }
      return bf > 0.9 ? best : -1;
    };
    // 위·아래 끝의 색 없는 회색 띠(표 머리글 칸 등) 잘라내기
    const rowSat = (y, x0, x1)=>{ let t = 0; for(let x = x0; x < x1; x++) t += sat[y * W + x]; return t / Math.max(1, x1 - x0); };
    bx = bx.map(b => {
      let [x0, y0, x1, y1] = b; const lim = Math.round((y1 - y0) * 0.35);
      const lineAt = (y)=>{ for(let yy = Math.max(0, y - 4); yy <= Math.min(H - 1, y + 4); yy++){ let n = 0; for(let x = x0; x < x1; x++) if(lum[yy * W + x] < 170) n++; if(n / Math.max(1, x1 - x0) > 0.8) return true; } return false; };
      let k = 0; while(k < lim && rowSat(y1 - 1 - k, x0, x1) < 9) k++; if(k > 6 && lineAt(y1 - k)) y1 -= k;      // 표 선에서 끝나는 회색 띠만
      k = 0; while(k < lim && rowSat(y0 + k, x0, x1) < 9) k++; if(k > 6 && lineAt(y0 + k)) y0 += k;
      return [x0, y0, x1, y1];
    });
    const out = [];
    bx.forEach(b => {
      const w = b[2] - b[0], h = b[3] - b[1];
      if(h > w * 0.9){ const k = darkLine(b, true); if(k > 0){ out.push([b[0], b[1], b[2], b[1] + k - 2], [b[0], b[1] + k + 3, b[2], b[3]]); return; } }
      if(w > h * 1.6){ const k = darkLine(b, false); if(k > 0){ out.push([b[0], b[1], b[0] + k - 2, b[3]], [b[0] + k + 3, b[1], b[2], b[3]]); return; } }
      out.push(b);
    });
    out.sort((a, b)=> (Math.abs(a[1] - b[1]) < H * 0.05 ? a[0] - b[0] : a[1] - b[1]));
    return out.map(b => b3aTrSub(c, b[0] * S + 2, b[1] * S + 2, b[2] * S - 2, b[3] * S - 2));
  }
  // 쪽 맨 위 제목으로 쪽 종류 구분
  async function b3aTrClassify(c){
    const band = b3aTrClean(b3aTrSub(c, 0, 0, c.width, c.height * 0.24));
    const t = (await b3aTrOcr(band, 6)).text || "", k = b3aTrNoSpace(t);
    let kind = "other";
    if(/안전보건교육/.test(k)) kind = "edu";
    else if(/참석확인서|참석자명단|서명부/.test(k)) kind = "attend";
    else if(/보고서/.test(k) && /훈련/.test(k)) kind = "report";
    else if(/사진대지|훈련실시|개선대책|훈련사진/.test(k) && !/관리자첨부/.test(k)) kind = "photo";
    return { kind, text: t };
  }

  function b3aTrFindDate(t){
    const s = String(t || "");
    let m = /(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/.exec(s);
    if(!m) return "";
    const p2 = (n)=> String(n).padStart(2, "0");
    return `${m[1]}-${p2(m[2])}-${p2(m[3])}`;
  }
  function b3aTrItems(t){
    let s = String(t || "").replace(/[|｜_]/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
    // 스캔본에서 "20kg"가 "20<6"·"206"·"20(<6"처럼 읽히는 것 바로잡기 (소화기 앞 숫자만)
    s = s.replace(/(\d{1,2}(?:\.\d)?)\s*\(?\s*<?\s*(?:[kK][gG]|[6Gg9])\s*(?=소화기)/g, "$1kg ").trim();
    const parts = s.split(/(?:^|\s)(?=\d\s*[.,]\s*\S)/).map(x => x.trim()).filter(x => x.replace(/^\d\s*[.,]\s*/, "").length >= 2);
    if(parts.length <= 1) return s;
    return parts.map((x, i)=> (i + 1) + ". " + x.replace(/^\d\s*[.,]\s*/, "")).join("\n");   // 번호는 1부터 차례로
  }

  // 보고서 쪽: 일자, 실참석·출역인원, 문제점·개선사항
  async function b3aTrReport(c){
    const out = { date: "", done: "", target: "", lack: "", improve: "" };
    const clean = b3aTrClean(c);
    const data = await b3aTrOcr(clean, 4, true), text = data.text || "";
    const lines = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push(l))));
    const dl = lines.find(l => /현장명|일시/.test(b3aTrNoSpace(l.text)) && b3aTrFindDate(l.text));
    out.date = b3aTrFindDate(dl ? dl.text : text);
    const nt = b3aTrNoSpace(text);
    let m = /실참석[^\d]{0,3}(\d{1,4})/.exec(nt); if(m) out.done = m[1];
    m = /출역인원[^\d]{0,3}(\d{1,4})/.exec(nt); if(m) out.target = m[1];
    // 문제점·개선사항 표: 머리글 줄 위치 + 세로 선으로 칸을 찾아 칸별로 읽기
    const head = lines.find(l => { const k = b3aTrNoSpace(l.text); return /문제점/.test(k) && /개선/.test(k); });
    if(head){
      const words = head.words || [];
      // 글자가 "개 선 사 항"처럼 낱자로 나뉘어 읽혀도 위치를 찾도록, 이어지는 단어를 붙여서 찾음
      const span = (re)=>{
        for(let i = 0; i < words.length; i++){
          let t = "", j = i;
          for(; j < Math.min(words.length, i + 4); j++){ t += b3aTrNoSpace(words[j].text); if(re.test(t)) return { x0: words[i].bbox.x0, x1: words[j].bbox.x1 }; }
        }
        return null;
      };
      const wP = span(/^문제/), wI = span(/^개선/);
      if(wP && wI){
        const xP = (wP.x0 + wP.x1) / 2, xI = (wI.x0 + wI.x1) / 2, yH = head.bbox.y1;
        const dm = b3aTrDark(c, 200), W = dm.W, H = dm.H;
        const ya = Math.min(H - 1, yH + 6), yb = Math.min(H, yH + Math.round(H * 0.12));
        const vs = [];
        for(let x = 0; x < W; x++){ let n = 0; for(let y = ya; y < yb; y++) n += dm.m[y * W + x]; if(n / Math.max(1, yb - ya) > 0.8) vs.push(x); }
        const V = b3aTrGroup(vs, 4);
        const L1 = Math.max(...V.filter(v => v < xP), 0), L2 = Math.min(...V.filter(v => v > xP && v < xI), xI - 10), L3 = Math.min(...V.filter(v => v > xI), W);
        let yEnd = yH + 6, gap = 0;
        for(let y = yH + 6; y < H; y++){
          let on = 0; for(let x = Math.max(0, L2 - 3); x <= Math.min(W - 1, L2 + 3); x++) on |= dm.m[y * W + x];
          if(on){ yEnd = y; gap = 0; } else if(++gap > 14) break;
        }
        if(yEnd - yH > 40 && L2 - L1 > 60 && L3 - L2 > 60){
          const pT = (await b3aTrOcr(b3aTrSub(clean, L1 + 8, yH + 6, L2 - 8, yEnd - 4), 6)).text;
          const iT = (await b3aTrOcr(b3aTrSub(clean, L2 + 8, yH + 6, L3 - 8, yEnd - 4), 6)).text;
          out.lack = b3aTrItems(pT); out.improve = b3aTrItems(iT);
        }
      }
    }
    return out;
  }

  // 참석확인서 쪽: 소속·성명·서명을 칸 단위로 오려서 그림으로
  async function b3aTrAttendance(c){
    const dm = b3aTrDark(c, 215), W = dm.W, H = dm.H;
    const ya = Math.round(H * 0.15), yb = Math.round(H * 0.8), vs = [];
    for(let x = 0; x < W; x++){ let n = 0; for(let y = ya; y < yb; y++) n += dm.m[y * W + x]; if(n / (yb - ya) > 0.55) vs.push(x); }
    let V = b3aTrGroup(vs, 4);
    if(V.length < 9) return null;
    if(V.length > 9){   // 표 바깥 선이 섞이면, 가장 넓게 퍼진 9개 연속 선을 표로 봄
      let best = 0, bi = 0; for(let i = 0; i + 8 < V.length; i++){ const sp = V[i + 8] - V[i]; if(sp > best){ best = sp; bi = i; } }
      V = V.slice(bi, bi + 9);
    }
    const x0 = V[0], x8 = V[8], dh = b3aTrDark(c, 200), hs = [];
    for(let y = 0; y < H; y++){ let n = 0; for(let x = x0; x < x8; x++) n += dh.m[y * W + x]; if(n / (x8 - x0) > 0.55) hs.push(y); }
    const HL = b3aTrGroup(hs, 4);
    if(HL.length < 2) return null;
    const top = HL[0], bottom = HL[HL.length - 1];
    let hb = HL.length >= 3 && (HL[1] - top) < (bottom - top) * 0.08 ? HL[1] : top + (bottom - top) / 26;
    // 행 개수: 번호 칸 가장자리에서 흐린 가로줄 간격을 보고 추정 (못 찾으면 25줄)
    const fl = [];
    for(let y = Math.round(hb) + 4; y < bottom - 4; y++){
      let n = 0, tot = 0;
      [[V[0] + 4, V[0] + Math.round((V[1] - V[0]) * 0.25)], [V[4] + 4, V[4] + Math.round((V[5] - V[4]) * 0.25)]].forEach(([a, b]) => { for(let x = a; x < b; x++){ n += dm.m[y * W + x]; tot++; } });
      if(n / Math.max(1, tot) > 0.6) fl.push(y);
    }
    const FL = b3aTrGroup(fl, 3), diffs = [];
    for(let i = 1; i < FL.length; i++) diffs.push(FL[i] - FL[i - 1]);
    const span = bottom - hb;
    let rows = 25;
    const small = diffs.filter(d => d > span / 60).sort((a, b)=> a - b)[0];
    if(small){ const est = Math.round(span / small); if(est >= 10 && est <= 40) rows = est; }
    const rh = span / rows, out = [];
    for(let side = 0; side < 2; side++){
      const cOrg = [V[1 + side * 4], V[2 + side * 4]], cName = [V[2 + side * 4], V[3 + side * 4]], cSig = [V[3 + side * 4], V[4 + side * 4]];
      for(let r = 0; r < rows; r++){
        const y0 = hb + r * rh, y1 = y0 + rh, py = Math.max(3, rh * 0.1);
        const cut = (cc)=>{ const px = Math.max(4, (cc[1] - cc[0]) * 0.05); return b3aTrSub(c, cc[0] + px, y0 + py, cc[1] - px, y1 - py); };
        const nm = b3aTrInk(cut(cName));
        if(!nm) continue;   // 성명이 비어 있으면 빈 줄
        const og = b3aTrInk(cut(cOrg)), sg = b3aTrInk(cut(cSig));
        const orgKind = !og ? "empty" : (og.w < og.cellW * 0.35 ? "ditto" : "name");
        out.push({ org: "", name: "", sig: sg ? sg.url : "", orgImg: og ? og.url : "", nameImg: nm.url, _orgKind: orgKind, _orgCanvas: og && orgKind === "name" ? og.canvas : null });
      }
    }
    return out;
  }

  // 참석확인서 소속 칸으로 업체별 인원 묶기 ("〃"·빈칸은 윗줄 업체와 같음)
  async function b3aTrTrade(rows){
    const groups = [];
    for(const r of rows){
      if(r._orgKind === "name" || !groups.length){
        let nm = "";
        if(r._orgCanvas){ try{ const od = await b3aTrOcr(b3aTrClean(r._orgCanvas), 7); if((od.confidence || 0) >= 75) nm = (od.text || "").replace(/[^가-힣A-Za-z0-9()（）]/g, ""); }catch(e){} }   // 손글씨는 확실할 때만
        groups.push({ name: nm, count: 1 });
      }else groups[groups.length - 1].count++;
    }
    const merged = [];
    groups.forEach(g => { const k = g.name; const ex = k && merged.find(m => m.name === k); if(ex) ex.count += g.count; else merged.push({ ...g }); });
    let k = 0;
    return merged.map(g => `${g.name && g.name.length >= 2 ? g.name : "업체" + "①②③④⑤⑥⑦⑧⑨⑩"[Math.min(9, k++)] + "(이름 확인)"}(${g.count})`).join(", ");
  }

  async function b3aTrReadFile(file, fi, total){
    const tag = total > 1 ? `${fi + 1}/${total}번째 파일 ` : "";
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const day = { kind: "training", date: "", time: "", cnt: "", done: "", place: "현장 일원", trade: "", lack: "", improve: "",
                  rosterRows: [], photos: [], selected: null, companyCount: 0, names: [file.name], gubun: ["비상대비훈련(화재·폭발)"] };
    const photoPages = [];
    let eduStarted = false, anyDate = "";
    for(let n = 1; n <= pdf.numPages; n++){
      b3aOcrSetStatus(`⏳ ${tag}${n}/${pdf.numPages}쪽 확인 중...`);
      const c = await b3aTrRender(pdf, n, 2.5);
      const cls = await b3aTrClassify(c);
      if(!anyDate) anyDate = b3aTrFindDate(cls.text);
      if(cls.kind === "edu") eduStarted = true;
      if(eduStarted) continue;                       // 같은 파일 뒤쪽의 안전보건교육일지는 훈련 결과에 넣지 않음
      if(cls.kind === "report"){
        b3aOcrSetStatus(`⏳ ${tag}훈련 보고서 내용을 읽는 중...`);
        const r = await b3aTrReport(c);
        day.date = day.date || r.date; day.cnt = day.cnt || r.target; day.done = day.done || r.done;
        day.lack = day.lack || r.lack; day.improve = day.improve || r.improve;
        photoPages.push({ n, c, first: false });
      }else if(cls.kind === "attend" && !day.rosterRows.length){
        b3aOcrSetStatus(`⏳ ${tag}참석확인서에서 소속·이름·서명을 오려 내는 중...`);
        const rows = await b3aTrAttendance(c);
        if(rows && rows.length){
          day.trade = await b3aTrTrade(rows);
          // 별지 3-2는 좌우로 번갈아 채워서 "〃"가 뜻을 잃으므로, 〃·빈칸은 윗줄 업체명 그림으로 바꿈
          let last = "";
          rows.forEach(r => { if(r._orgKind === "name") last = r.orgImg; else if(last) r.orgImg = last; });
          day.rosterRows = rows;
        }
      }else if(cls.kind === "photo"){
        photoPages.push({ n, c, first: /훈련실시/.test(b3aTrNoSpace(cls.text)) });
      }
    }
    day.date = day.date || anyDate;
    if(!day.done && day.rosterRows.length) day.done = String(day.rosterRows.length);
    if(!day.cnt) day.cnt = day.done;
    // 사진: "훈련실시" 쪽을 먼저, 그다음 보고서·다른 사진대지 쪽
    photoPages.sort((a, b)=> (b.first - a.first) || (a.n - b.n));
    const photos = [];
    for(const pp of photoPages){
      b3aOcrSetStatus(`⏳ ${tag}${pp.n}쪽 사진을 찾는 중...`);
      try{
        b3aTrFindPhotos(pp.c).forEach(oc => {
          if(oc.width < 120 || oc.height < 90) return;
          photos.push({ url: b3aOcrCanvasToDataUrl(oc), pageLabel: `${pp.n}p`, main: !!pp.first });
        });
      }catch(e){ console.warn("훈련 사진 추출 실패", e); }
    }
    day.photos = await b3aOcrDedupePhotos(photos);
    for(const ph of day.photos) ph.url = await b3aOcrShrink(ph.url, 1000, 0.8);
    { const mains = day.photos.filter(ph => ph.main).map(ph => ph.url); if(mains.length) day.selected = mains; }   // "훈련실시" 쪽 사진만 기본 선택
    day.rosterRows.forEach(r => { delete r._orgCanvas; });
    return day;
  }

  document.getElementById("b3a-tr-start-btn").addEventListener("click", async ()=>{
    const files = b3aOcrSelectedFiles.slice();
    if(!files.length){ alert("먼저 위 칸에 훈련 보고서 PDF를 끌어다 놓거나 선택해주세요."); return; }
    const btn = document.getElementById("b3a-tr-start-btn"), btn2 = document.getElementById("b3a-ocr-start-btn");
    btn.disabled = true; btn2.disabled = true;
    document.getElementById("b3a-ocr-review").style.display = "none";
    try{
      b3aOcrSetStatus("⏳ 인식 엔진을 불러오는 중이에요... (인터넷 필요, 처음엔 다소 걸려요)");
      await b3aOcrEnsureScriptsLoaded(); await b3aOcrEnsureWorker();
      const days = [], failed = [];
      for(let i = 0; i < files.length; i++){
        try{ days.push(await b3aTrReadFile(files[i], i, files.length)); }
        catch(err){ console.error(err); failed.push(files[i].name); }
      }
      if(!days.length) throw new Error("읽을 수 있는 PDF가 없어요");
      days.sort((a, b)=> String(a.date).localeCompare(String(b.date)));
      b3aOcrDays = days; b3aOcrFillDaySelect(); b3aOcrDayIdx = 0; b3aOcrLoadDay(0);
      const d0 = days[0];
      b3aOcrSetStatus(`✅ 훈련 보고서 ${days.length}건 → ${d0.date || "날짜 미확인"} · 실참석 ${d0.done || "?"}명 / 출역 ${d0.cnt || "?"}명 · 참석확인서 ${d0.rosterRows.length}명 · 사진 ${d0.photos.length}장을 찾았어요. 검토 후 저장해주세요.`
        + (failed.length ? ` (읽지 못한 파일: ${failed.join(", ")})` : ""));
      document.getElementById("b3a-ocr-review").style.display = "block";
    }catch(err){
      console.error(err);
      b3aOcrSetStatus("❌ 훈련 보고서를 읽는 중 문제가 발생했어요: " + (err && err.message ? err.message : err));
    }finally{ btn.disabled = false; btn2.disabled = false; }
  });

"""

TRAIN_APPLY = r"""
    // (WOOMI) 훈련 보고서로 읽은 경우: 구분·인원·미비점·개선사항을 훈련용으로
    {
      const td = b3aOcrDays[b3aOcrDayIdx];
      if(td && td.kind === "training"){
        const setC = (id, v)=>{ const el = document.getElementById(id); if(el) el.checked = v; };
        ["b3a-chk-edu","b3a-chk-recruit","b3a-chk-fire","b3a-chk-init-edu"].forEach(id => setC(id, false));
        ["b3a-chk-training","b3a-chk-evac","b3a-chk-init-training"].forEach(id => setC(id, true));
        const tgt = String(td.cnt || "").trim(), dn = String(td.done || "").trim();
        if(tgt) document.getElementById("b3a-target-cnt").value = tgt;
        if(dn) document.getElementById("b3a-done-cnt").value = dn;
        const miss = document.getElementById("b3a-miss-cnt");
        if(miss && tgt && dn && !isNaN(+tgt) && !isNaN(+dn)) miss.value = String(Math.max(0, +tgt - +dn));
        updateB3aMainFromChecks();
        try{ updateB3aLackImproveVisibility(); }catch(e){}
        document.getElementById("b3a-lack").value = td.lack || "";
        document.getElementById("b3a-improve").value = td.improve || "";
        renderB3a();
      }
    }

    return rosterAppliedCount;
  }
"""

PAIRS = [
    (TRAIN_BTN_OLD, TRAIN_BTN_NEW),
    (TRAIN_REVIEW_OLD, TRAIN_REVIEW_NEW),
    ("  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }",
     TRAIN_CSS + "  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }"),
    # 새 기능 코드 (기존 PDF 자동 채우기 버튼 처리 바로 앞)
    ('  document.getElementById("b3a-ocr-start-btn").addEventListener("click", async ()=>{\n',
     TRAIN_JS + '  document.getElementById("b3a-ocr-start-btn").addEventListener("click", async ()=>{\n'),
    # 검토 화면: 훈련 항목 보이기/저장
    ('    document.getElementById("b3a-ocr-r-trade").value = d.trade || "";\n    b3aOcrRosterRows = d.rosterRows;',
     '    document.getElementById("b3a-ocr-r-trade").value = d.trade || "";\n'
     '    { const tr = d.kind === "training", ex = document.getElementById("b3a-tr-extra"); ex.style.display = tr ? "" : "none";\n'
     '      document.getElementById("b3a-ocr-r-done").value = tr ? (d.done || "") : ""; document.getElementById("b3a-ocr-r-lack").value = tr ? (d.lack || "") : ""; document.getElementById("b3a-ocr-r-improve").value = tr ? (d.improve || "") : ""; }\n'
     '    b3aOcrRosterRows = d.rosterRows;'),
    ('    d.trade = document.getElementById("b3a-ocr-r-trade").value.trim();\n    d.selected = b3aOcrSelected.slice();',
     '    d.trade = document.getElementById("b3a-ocr-r-trade").value.trim();\n'
     '    if(d.kind === "training"){ d.done = document.getElementById("b3a-ocr-r-done").value.trim(); d.lack = document.getElementById("b3a-ocr-r-lack").value.trim(); d.improve = document.getElementById("b3a-ocr-r-improve").value.trim(); }\n'
     '    d.selected = b3aOcrSelected.slice();'),
    # 적용: 훈련용 값 넣기
    ("\n    return rosterAppliedCount;\n  }\n", TRAIN_APPLY),
    # 별지 3-2: 그림으로 된 소속·성명도 명단으로 인정
    ("""        .filter(r => (r.name||"").trim())
        .forEach(r=>{
          const key = b3bRosterKey(r.org, r.name);""",
     """        .filter(r => (r.name||"").trim() || r.nameImg)
        .forEach(r=>{
          const key = (!(r.name||"").trim() && r.nameImg) ? "img:" + seenKeys.size : b3bRosterKey(r.org, r.name);"""),
    ("""          replaced.push({ org: r.org||"", name: r.name||"", sig: r.sig || (old && old.sig) || "" });""",
     """          replaced.push({ org: r.org||"", name: r.name||"", sig: r.sig || (old && old.sig) || "", orgImg: r.orgImg || "", nameImg: r.nameImg || "" });"""),
    ("""    const rows = (Array.isArray(arr) ? arr : []).map(r => ({ org: r.org||"", name: r.name||"", sig: r.sig||"" }));""",
     """    const rows = (Array.isArray(arr) ? arr : []).map(r => ({ org: r.org||"", name: r.name||"", sig: r.sig||"", orgImg: r.orgImg||"", nameImg: r.nameImg||"" }));"""),
    ("""      || roster.some(r => (r.name||"").trim() || (r.org||"").trim()));""",
     """      || roster.some(r => (r.name||"").trim() || (r.org||"").trim() || r.nameImg));"""),
    ("""      const roster = (data._roster || []).filter(r => r.name || r.org || r.sig);""",
     """      const roster = (data._roster || []).filter(r => r.name || r.org || r.sig || r.nameImg || r.orgImg);"""),
    # 별지 3-2 미리보기: 글자가 없으면 그림으로
    ("""    const people = b3bRows.filter(r => (r.org||"").trim() || (r.name||"").trim() || r.sig);""",
     """    const people = b3bRows.filter(r => (r.org||"").trim() || (r.name||"").trim() || r.sig || r.nameImg || r.orgImg);
    const txtOrImg = (r, t, im)=> (r[t]||"").trim() ? esc3a(r[t]) : (r[im] ? `<img src="${r[im]}" class="pv-name-img" alt="" />` : "");"""),
    ("""          <td>${left ? esc3a(left.org || "") : ""}</td><td>${left ? esc3a(left.name || "") : ""}</td><td class="sig-td">${sigCell(left)}</td>
          <td>${right ? esc3a(right.org || "") : ""}</td><td>${right ? esc3a(right.name || "") : ""}</td><td class="sig-td">${sigCell(right)}</td>""",
     """          <td>${left ? txtOrImg(left, "org", "orgImg") : ""}</td><td>${left ? txtOrImg(left, "name", "nameImg") : ""}</td><td class="sig-td">${sigCell(left)}</td>
          <td>${right ? txtOrImg(right, "org", "orgImg") : ""}</td><td>${right ? txtOrImg(right, "name", "nameImg") : ""}</td><td class="sig-td">${sigCell(right)}</td>"""),
    # 별지 3-2 입력 칸: 그림 미리보기
    ("""        <input type="text" placeholder="소속" data-b3b-field="org" data-b3b-idx="${idx}" value="${(row.org||"").replace(/"/g,"&quot;")}" />
        <input type="text" placeholder="성명" data-b3b-field="name" data-b3b-idx="${idx}" value="${(row.name||"").replace(/"/g,"&quot;")}" />""",
     """        ${row.orgImg ? `<img src="${row.orgImg}" class="b3b-img-thumb" alt="소속" title="손글씨 소속 (글자를 입력하면 글자로 바뀌어요)" />` : ""}<input type="text" placeholder="소속" data-b3b-field="org" data-b3b-idx="${idx}" value="${(row.org||"").replace(/"/g,"&quot;")}" />
        ${row.nameImg ? `<img src="${row.nameImg}" class="b3b-img-thumb" alt="성명" title="손글씨 성명 (글자를 입력하면 글자로 바뀌어요)" />` : ""}<input type="text" placeholder="성명" data-b3b-field="name" data-b3b-idx="${idx}" value="${(row.name||"").replace(/"/g,"&quot;")}" />"""),
    # 검토 화면 명단: 그림 미리보기
    ("""        <input type="text" data-roster-field="org" data-roster-idx="${idx}" value="${(r.org||"").replace(/"/g,"&quot;")}" placeholder="소속" style="flex:1.3" />
        <input type="text" data-roster-field="name" data-roster-idx="${idx}" value="${(r.name||"").replace(/"/g,"&quot;")}" placeholder="성명" style="flex:1" />""",
     """        ${r.orgImg ? `<img src="${r.orgImg}" class="b3a-ocr-roster-sig" alt="소속" />` : ""}<input type="text" data-roster-field="org" data-roster-idx="${idx}" value="${(r.org||"").replace(/"/g,"&quot;")}" placeholder="${r.orgImg ? "(손글씨 그대로)" : "소속"}" style="flex:1.3" />
        ${r.nameImg ? `<img src="${r.nameImg}" class="b3a-ocr-roster-sig" alt="성명" />` : ""}<input type="text" data-roster-field="name" data-roster-idx="${idx}" value="${(r.name||"").replace(/"/g,"&quot;")}" placeholder="${r.nameImg ? "(손글씨 그대로)" : "성명"}" style="flex:1" />"""),
    ('<td colspan="4" id="b3a-pv-lack">&nbsp;</td>', '<td colspan="4" id="b3a-pv-lack" style="white-space:pre-line">&nbsp;</td>'),
    ('<td colspan="4" id="b3a-pv-improve">&nbsp;</td>', '<td colspan="4" id="b3a-pv-improve" style="white-space:pre-line">&nbsp;</td>'),
]

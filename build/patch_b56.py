# 안전점검 지적내역서(별지 5) · 조치 결과 통보서(별지 6)
# - 메뉴 세 번째, 별지 5·6을 한 화면(b56CombinedView)에서 작성·미리보기·인쇄
# - 안전팀 "추가위험발굴지시/조치" 묶음 PDF(한 쪽에 여러 건)를 건별로 읽음: 글자 + 지적 사진(왼쪽) + 조치 사진(오른쪽)
# - 소방 점검 분류(임시소방시설 / 피난로 등 / 화기취급감독), 소방과 무관한 지적은 기본 제외
# - 지시일자별로 따로 기록 저장 (IndexedDB, 암호화)
# - 협력사 서명 등록 → 별지 5 완료(확인자)·별지 6 제출자에 자동으로
# - 별지 6에 모든 항목의 지적 사진 → 조치 사진

COMBINED_HTML = '''
<!-- ============ 별지 5 · 6 한 화면 (WOOMI) ============ -->
<div id="b56CombinedView" class="app view-hidden">
  <aside class="panel" id="b56Panel"></aside>
  <main class="preview-wrap" id="b56Main"></main>
</div>
'''

MERGE_JS = r'''(function mergeB56(){
  const a = document.getElementById("byeolji5FormView"), b = document.getElementById("byeolji6FormView");
  const panel = document.getElementById("b56Panel"), main = document.getElementById("b56Main");
  if(!a || !b || !panel || !main) return;
  const pa = a.querySelector("aside.panel"), pb = b.querySelector("aside.panel");
  const ma = a.querySelector("main.preview-wrap"), mb = b.querySelector("main.preview-wrap");
  [pa, pb].forEach(p => p.querySelectorAll(".back-link, .brand").forEach(e => e.remove()));
  while(pa.firstChild) panel.appendChild(pa.firstChild);
  const sep = document.createElement("hr"); sep.className = "b3c-sep"; panel.appendChild(sep);
  while(pb.firstChild) panel.appendChild(pb.firstChild);
  const tt = ma.querySelector(".preview-toolbar .title"); if(tt) tt.textContent = "미리보기 · 별지 5 · 6 (한 번에 인쇄)";
  const tb2 = mb.querySelector(".preview-toolbar"); if(tb2) tb2.style.display = "none";
  while(ma.firstChild) main.appendChild(ma.firstChild);
  while(mb.firstChild) main.appendChild(mb.firstChild);
  [a, b].forEach(v => v.remove());
})();
'''

B56_CSS = """
  #b56Panel .b3c-sep{ margin:22px 0; border:0; border-top:2px dashed var(--line,#dde); }
  #b56CombinedView .ch1-paper + .ch1-paper{ margin-top:24px; }
  @media print{ #b56CombinedView .ch1-paper + .ch1-paper{ break-before:page; page-break-before:always; margin-top:0; } }
  #b56RecList .b56-rec{ display:flex; align-items:center; gap:6px; padding:7px 9px; border:1px solid #e2e5ea; border-radius:8px; margin-bottom:5px; cursor:pointer; font-size:13px; background:#fff; }
  #b56RecList .b56-rec.on{ border-color:#2451c9; background:#eef3ff; }
  #b56RecList .b56-rec b{ flex:none; }
  #b56RecList .b56-rec span{ flex:1; min-width:0; color:#5a6272; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #b56RecList .b56-rec button{ flex:none; border:0; background:none; color:#c0392b; cursor:pointer; }
  .b56-btns{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .b56-btns button{ flex:1; min-width:90px; }
  .rev-row-editor.b56-off{ opacity:.45; }
  .rev-row-editor.b56-off textarea, .rev-row-editor.b56-off input[type=text]{ background:#f4f5f7; }
  .b56-inc{ font-weight:700; color:#27407f; }
  .b56-kindtag{ display:inline-block; font-size:11px; padding:1px 6px; border-radius:10px; background:#eef3ff; color:#27407f; margin-left:4px; }
  .b56-kindtag.none{ background:#f1f2f4; color:#8a92a3; }
  .b56-photos{ display:flex; gap:6px; margin:6px 0; }
  .b56-photos figure{ flex:1; margin:0; text-align:center; font-size:11px; color:#5a6272; }
  .b56-photos img{ width:100%; height:92px; object-fit:contain; background:#f7f8fa; border:1px solid #e2e5ea; border-radius:4px; }
  .b56-sigrow{ display:grid; grid-template-columns:1fr 92px auto; gap:6px; align-items:center; margin-bottom:6px; font-size:13px; }
  .b56-sigrow .sig{ height:34px; border:1px dashed #c5cbd6; border-radius:6px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; color:#98a2b3; overflow:hidden; }
  .b56-sigrow .sig img{ max-height:30px; max-width:88px; }
  .b56-sigrow .acts{ display:flex; gap:4px; }
  .b56-sigrow .acts button{ font-size:11px; padding:4px 6px; }
  #b56SigModal{ position:fixed; inset:0; z-index:9000; display:none; align-items:center; justify-content:center; background:rgba(15,20,40,.5); margin:0 !important; }
  #b56SigModal.on{ display:flex; }
  #b56SigModal .box{ background:#fff; border-radius:12px; padding:16px; width:min(420px, 92vw); }
  #b56SigModal canvas{ width:100%; aspect-ratio:2.6/1; border:1.5px dashed #b8c3da; border-radius:8px; touch-action:none; background:#fff; }
  .b56-done-sig{ display:block; max-height:8mm; max-width:100%; margin:1mm auto 0; }
  .b56-ph{ display:flex; gap:2mm; margin-bottom:1.5mm; }
  .b56-ph figure{ flex:1; margin:0; }
  .b56-ph img{ display:block; width:100%; height:34mm; object-fit:contain; border:1px solid #bbb; background:#fff; }
  .b56-ph figcaption{ font-size:8.5pt; text-align:center; font-weight:700; margin-top:.5mm; }
  .b56-subm{ display:inline-flex; align-items:center; gap:2mm; margin-right:4mm; }
  .b56-subm img{ max-height:9mm; max-width:30mm; }
"""

B56_JS = r"""
  /* ================= WOOMI: 별지 5·6 – 묶음 PDF 읽기, 소방 분류, 날짜별 기록, 협력사 서명 ================= */
  // 소방 점검 분류 (임시소방시설 / 피난로 등 / 화기취급감독), 하나도 안 걸리면 소방과 무관
  function b56Classify(text){
    const t = String(text || "");
    const tempFacility = /소화기|소화전|임시소방|소방시설|감지기|경보기|스프링클러|방화포|간이피난유도선|비상조명/.test(t);
    const evacRoute = /피난|대피|비상구|유도등|비상계단|통로|통행로|보행로|출입구/.test(t);
    // "소화기" 안의 "화기", "재적발 시 절단" 같은 말에 걸리지 않게
    const fireSupervise = /(?<!소)화기|용접|용단|(가스|산소)\s*절단|절단\s*작업|불티|역화|산소|아세틸렌|LPG|가스\s*용기|화재감시|연소|인화|가연|화재\s*(위험|우려|발생)/.test(t);
    return { tempFacility, evacRoute, fireSupervise, relevant: tempFacility || evacRoute || fireSupervise };
  }

  // 묶음 PDF 한 개 → 건별 행 목록 (한 쪽에 여러 건)
  async function b56ReadAll(file){
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out = [];
    for(let n = 1; n <= pdf.numPages; n++){
      b5SetPdfStatus(`⏳ ${file.name} · ${n}/${pdf.numPages}쪽 읽는 중...`);
      const page = await pdf.getPage(n), tc = await page.getTextContent();
      const pageH = page.view[3] - page.view[1];
      const labels = b5BuildSegments(tc.items).filter(sg => sg.text === "현장명").sort((x, y)=> y.y - x.y);
      if(!labels.length) continue;
      const S = 2.5, vp = page.getViewport({ scale: S });
      const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
      await page.render({ canvasContext: cx, viewport: vp }).promise;
      let prevBottom = 0;   // 위쪽에서부터의 거리(pt): 앞 건 표의 아래
      for(let i = 0; i < labels.length; i++){
        const L = labels[i], low = i + 1 < labels.length ? labels[i + 1].y + 3 : -1;
        const items = tc.items.filter(it => it.transform && it.transform[5] <= L.y + 3 && it.transform[5] > low);
        const d = b5ParseDispatchItems(items);
        const blockMinY = Math.min(...items.map(it => it.transform[5]).filter(v => v > 40), L.y);
        if(!d){ prevBottom = pageH - blockMinY + 12; continue; }
        const row = b5DispatchToRow(d);
        // 사진: 이 건의 "현장명" 줄 바로 위 띠 (왼쪽 = 지적, 오른쪽 = 조치)
        let before = "", after = "";
        try{
          const y0 = Math.max(0, Math.round(prevBottom * S)), y1 = Math.round((pageH - L.y - 10) * S);
          if(y1 - y0 > 60){
            const band = b3aTrSub(cv, 0, y0, cv.width, y1), half = band.width / 2;
            const ph = b3aTrFindPhotos(band, { noSplit: true }).filter(p => p.canvas.width > 80 && p.canvas.height > 80);
            const pickSide = (left)=> ph.filter(p => ((p.box[0] + p.box[2]) / 2 < half) === left).sort((p, q)=> q.canvas.width * q.canvas.height - p.canvas.width * p.canvas.height)[0];
            const bl = pickSide(true), br = pickSide(false);
            if(bl) before = await b3aOcrShrink(bl.canvas.toDataURL("image/jpeg", 0.88), 900, 0.8);
            if(br) after = await b3aOcrShrink(br.canvas.toDataURL("image/jpeg", 0.88), 900, 0.8);
          }
        }catch(e){ console.warn("점검 사진 읽기 실패", e); }
        prevBottom = pageH - blockMinY + 12;
        const k = b56Classify((d["유해위험요인"] || "") + " " + (d["위험성감소대책"] || ""));
        const done = d["조치여부"] === "조치";
        Object.assign(row, {
          tempFacility: k.tempFacility, evacRoute: k.evacRoute, fireSupervise: k.fireSupervise,
          include: k.relevant, relevant: k.relevant,
          doneBy: done ? (row.company || "") : "", _done: done,
          photoBefore: before, photo: after, usePhoto: true,
        });
        out.push(row);
      }
    }
    return out;
  }

  // ---- 날짜별 기록 (IndexedDB, 암호화) ----
  const B56_DB = "fireplan_b56_db";
  let b56Records = [], b56CurId = null;
  function b56Idb(){ return new Promise((res, rej)=>{ const r = indexedDB.open(B56_DB, 1); r.onupgradeneeded = ()=>{ if(!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); }; r.onsuccess = ()=> res(r.result); r.onerror = ()=> rej(r.error); }); }
  async function b56Load(){
    try{
      const db = await b56Idb();
      const v = await new Promise((res, rej)=>{ const q = db.transaction("kv").objectStore("kv").get("records"); q.onsuccess = ()=> res(q.result); q.onerror = ()=> rej(q.error); });
      db.close();
      const list = await WoomiSec.decVal(v);
      b56Records = Array.isArray(list) ? list : [];
    }catch(e){ console.warn(e); b56Records = []; }
    b56RenderRecs();
  }
  function b56Persist(){
    const snap = JSON.parse(JSON.stringify(b56Records));
    return WoomiSec.trackIdb((async ()=>{
      const enc = await WoomiSec.encVal(snap), db = await b56Idb();
      await new Promise((res, rej)=>{ const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put(enc, "records"); tx.oncomplete = ()=> res(); tx.onerror = tx.onabort = ()=> rej(tx.error); });
      db.close();
    })()).catch(e => { console.error(e); alert("점검 기록 저장에 실패했어요. 저장 공간이 부족할 수 있어요."); });
  }
  function b56Meta(key){ try{ return JSON.parse(localStorage.getItem(key) || "{}"); }catch(e){ return {}; } }
  function b56Snapshot(){
    const m5 = b56Meta(B5_META_KEY), m6 = b56Meta(B6_META_KEY);
    return { date: m5.date || m6.date || "", rows5: JSON.parse(JSON.stringify(b5Rows)), rows6: JSON.parse(JSON.stringify(b6Rows)), meta5: m5, meta6: m6 };
  }
  function b56Apply(rec){
    b5Rows = JSON.parse(JSON.stringify(rec.rows5 && rec.rows5.length ? rec.rows5 : [{place:"",tempFacility:false,evacRoute:false,fireSupervise:false,issue:"",doneBy:"",noticeNo:""}]));
    b6Rows = JSON.parse(JSON.stringify(rec.rows6 && rec.rows6.length ? rec.rows6 : [{place:"",kind:"",issue:"",result:""}]));
    localStorage.setItem(B5_META_KEY, JSON.stringify(Object.assign({}, rec.meta5 || {}, { date: rec.date || "" })));
    localStorage.setItem(B6_META_KEY, JSON.stringify(Object.assign({}, rec.meta6 || {}, { date: rec.date || "" })));
    saveB5Rows(); saveB6Rows(); loadB5Meta(); loadB6Meta(); renderB5Form(); renderB6Form(); b56RenderSigs();
  }
  function b56RenderRecs(){
    const wrap = document.getElementById("b56RecList"); if(!wrap) return;
    const list = b56Records.slice().sort((x, y)=> String(y.date).localeCompare(String(x.date)));
    wrap.innerHTML = list.length ? list.map(r => {
      const cos = [...new Set((r.rows5 || []).map(x => x.company).filter(Boolean))].join(", ");
      return `<div class="b56-rec${r.id === b56CurId ? " on" : ""}" data-rid="${r.id}"><b>${esc3a((r.date || "날짜 없음").replace(/-/g, "."))}</b><span>${(r.rows5 || []).length}건 · ${esc3a(cos)}</span><button type="button" data-rdel="${r.id}" title="이 기록 삭제">✕</button></div>`;
    }).join("") : '<p class="save-note" style="margin:0">저장된 점검 기록이 없어요. PDF를 불러오면 날짜별로 저장돼요.</p>';
    document.getElementById("b56SaveUpd").disabled = !b56CurId;
  }
  // ---- 협력사 서명 ----
  const B56_SIG_KEY = "fireplan_co_sigs_v1";
  function b56Sigs(){ try{ const o = JSON.parse(localStorage.getItem(B56_SIG_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }catch(e){ return {}; } }
  function b56SetSig(name, url){ const o = b56Sigs(); if(url) o[name] = url; else delete o[name]; try{ localStorage.setItem(B56_SIG_KEY, JSON.stringify(o)); }catch(e){ alert("서명을 저장하지 못했어요."); } b56RenderSigs(); renderB5Preview(); renderB6Preview(); }
  function b56SigOf(name){ name = String(name || "").trim(); if(!name) return ""; const o = b56Sigs(); return o[name] || ""; }
  function b56RenderSigs(){
    const wrap = document.getElementById("b56SigList"); if(!wrap) return;
    const names = [...new Set(b5Rows.map(r => (r.doneBy || r.company || "").trim()).filter(Boolean).concat(Object.keys(b56Sigs())))];
    wrap.innerHTML = names.length ? names.map((n, i)=> { const s = b56SigOf(n); return `<div class="b56-sigrow"><span>${esc3a(n)}</span><span class="sig">${s ? `<img src="${s}" alt="서명">` : "서명 없음"}</span><span class="acts"><button type="button" class="reset-btn" data-sdraw="${i}">✍️ 서명</button><button type="button" class="reset-btn" data-sup="${i}">🖼 사진</button>${s ? `<button type="button" class="photo-remove-btn" data-sdel="${i}">삭제</button>` : ""}</span></div>`; }).join("")
      : '<p class="save-note" style="margin:0">지적사항에 협력사가 들어가면 여기에 나와요.</p>';
    wrap.querySelectorAll("[data-sdraw]").forEach(b => b.addEventListener("click", ()=> b56OpenPad(names[+b.dataset.sdraw])));
    wrap.querySelectorAll("[data-sdel]").forEach(b => b.addEventListener("click", ()=>{ if(confirm(names[+b.dataset.sdel] + " 서명을 지울까요?")) b56SetSig(names[+b.dataset.sdel], ""); }));
    wrap.querySelectorAll("[data-sup]").forEach(b => b.addEventListener("click", ()=>{
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = ()=>{ const f = inp.files[0]; if(!f) return; const im = new Image(); im.onload = ()=>{ const c = document.createElement("canvas"); const k = Math.min(1, 900 / im.width); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); const ink = b3aTrInk(c); if(!ink){ alert("서명을 찾지 못했어요. 흰 종이에 또렷하게 쓴 서명 사진을 넣어주세요."); return; } b56SetSig(names[+b.dataset.sup], ink.url); URL.revokeObjectURL(im.src); }; im.src = URL.createObjectURL(f); };
      inp.click();
    }));
  }
  function b56OpenPad(name){
    let m = document.getElementById("b56SigModal");
    if(!m){
      m = document.createElement("div"); m.id = "b56SigModal";
      m.innerHTML = '<div class="box"><p style="margin:0 0 8px;font-weight:700" id="b56SigTitle"></p><canvas width="780" height="300"></canvas><div class="b56-btns"><button type="button" class="reset-btn" data-pc="clear">지우기</button><button type="button" class="photo-remove-btn" data-pc="cancel">취소</button><button type="button" class="reset-btn" data-pc="save" style="background:#2451c9;color:#fff;border-color:#2451c9">이 서명 저장</button></div></div>';
      document.body.appendChild(m);
      const cv = m.querySelector("canvas"), cx = cv.getContext("2d"); cx.lineWidth = 5; cx.lineCap = "round"; cx.lineJoin = "round"; cx.strokeStyle = "#111";
      let on = false, dirty = false;
      const pos = (e)=>{ const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) * cv.width / r.width, (p.clientY - r.top) * cv.height / r.height]; };
      const down = (e)=>{ e.preventDefault(); on = true; const [x, y] = pos(e); cx.beginPath(); cx.moveTo(x, y); };
      const move = (e)=>{ if(!on) return; e.preventDefault(); const [x, y] = pos(e); cx.lineTo(x, y); cx.stroke(); dirty = true; };
      const up = ()=>{ on = false; };
      cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
      m.addEventListener("click", (e)=>{
        const a = e.target.dataset && e.target.dataset.pc; if(!a) return;
        if(a === "clear"){ cx.clearRect(0, 0, cv.width, cv.height); dirty = false; }
        if(a === "cancel"){ m.classList.remove("on"); }
        if(a === "save"){
          if(!dirty){ alert("먼저 위 칸에 서명해주세요."); return; }
          const d = cx.getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
          for(let y = 0; y < cv.height; y++) for(let x = 0; x < cv.width; x++) if(d[(y * cv.width + x) * 4 + 3] > 20){ if(x < x0) x0 = x; if(x > x1) x1 = x; if(y < y0) y0 = y; if(y > y1) y1 = y; }
          if(x1 < 0) return;
          const o = b3aTrSub(cv, x0 - 4, y0 - 4, x1 + 5, y1 + 5);
          b56SetSig(m.dataset.name, o.toDataURL("image/png"));
          cx.clearRect(0, 0, cv.width, cv.height); dirty = false; m.classList.remove("on");
        }
      });
    }
    m.dataset.name = name; document.getElementById("b56SigTitle").textContent = `✍️ ${name} 서명`;
    m.classList.add("on");
  }
  // ---- 미리보기 칸 ----
  function b56DoneCell(r){
    const n = String(r.doneBy || "").trim(); if(!n) return "";
    const s = b56SigOf(n);
    return esc3a(n) + (s ? `<img src="${s}" class="b56-done-sig" alt="서명" />` : "");
  }
  function b56ResultCell(r){
    const ph = [r.photoBefore ? `<figure><img src="${r.photoBefore}" alt="지적 사진" /><figcaption>지적 사진</figcaption></figure>` : "", r.photo ? `<figure><img src="${r.photo}" alt="조치 사진" /><figcaption>조치 사진</figcaption></figure>` : ""].filter(Boolean).join("");
    return (ph ? `<div class="b56-ph">${ph}</div>` : "") + esc3a(r.result || "");
  }
  function b56SubmitterCell(text){
    const names = String(text || "").split(/\s*,\s*/).filter(Boolean);
    if(!names.length) return " ";
    return names.map(n => { const s = b56SigOf(n); return `<span class="b56-subm">${esc3a(n)}${s ? `<img src="${s}" alt="서명" />` : " (서명)"}</span>`; }).join("");
  }
  // ---- 불러온 항목 → 날짜별 기록 ----
  window.b56ApplyImport = function(){
    const inc = b5ImportRows.filter(r => r.include !== false);
    if(!inc.length){ alert("넣을 항목이 없어요. 소방 점검에 넣을 항목을 체크해주세요."); return; }
    const confirmer = document.getElementById("b5-pdf-r-confirmer").value.trim();
    const groups = new Map();
    inc.forEach(r => { const k = r._date || ""; if(!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    const dates = [...groups.keys()].sort();
    let made = 0, merged = 0, last = null;
    dates.forEach(date => {
      const rows = groups.get(date), notice = date ? date + "-01" : "";
      const cos = [...new Set(rows.map(r => r.company).filter(Boolean))];
      const rows5 = rows.map(r => ({ company: r.company || "", trade: r.trade || "", place: r.place || "",
        tempFacility: !!r.tempFacility, evacRoute: !!r.evacRoute, fireSupervise: !!r.fireSupervise,
        issue: r.issue || "", doneBy: r.doneBy || "", noticeNo: r._done ? "" : notice, docNo: r.docNo || "" }));
      const rows6 = rows.map(r => ({ company: r.company || "", trade: r.trade || "", place: r.place || "", kind: b5KindText(r),
        issue: r.issue || "", result: r.result || "", photo: r.usePhoto !== false ? (r.photo || "") : "", photoBefore: r.usePhoto !== false ? (r.photoBefore || "") : "", docNo: r.docNo || "" }));
      let rec = b56Records.find(x => x.date === date);
      if(rec){   // 같은 날짜 기록이 있으면 문서번호로 합치기
        rows5.forEach(n5 => { const ex = rec.rows5.find(x => x.docNo && x.docNo === n5.docNo); if(ex) Object.assign(ex, n5); else rec.rows5.push(n5); });
        rows6.forEach(n6 => { const ex = rec.rows6.find(x => x.docNo && x.docNo === n6.docNo); if(ex) Object.assign(ex, n6); else rec.rows6.push(n6); });
        rec.meta6 = Object.assign({}, rec.meta6, { submitter: [...new Set(rec.rows5.map(x => x.company).filter(Boolean))].join(", ") });
        rec.savedAt = new Date().toISOString(); merged++;
      }else{
        rec = { id: "b56_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), savedAt: new Date().toISOString(), date,
          rows5, rows6, meta5: { date, inspector: B5_FIXED_INSPECTOR }, meta6: { date, noticeNo: notice, submitter: cos.join(", "), confirmer } };
        b56Records.push(rec); made++;
      }
      last = rec;
    });
    b56Persist();
    if(last){ b56CurId = last.id; b56Apply(last); }
    b56RenderRecs();
    document.getElementById("b5-pdf-review").style.display = "none";
    b5ImportRows = []; b5SetPdfStatus("");
    alert(`지시일자별로 ${dates.length}일치 기록을 저장했어요${merged ? ` (새 기록 ${made}개, 같은 날짜 기록에 합친 것 ${merged}개)` : ""}.\n위쪽 "날짜별 점검 기록"에서 날짜를 눌러 열 수 있어요. 지금은 가장 최근 날짜(${(last && last.date || "").replace(/-/g, ".")})를 보여드려요.`);
  };

  (function setupB56(){
    const panel = document.getElementById("b56Panel"); if(!panel) return;
    // 맨 위: 날짜별 점검 기록
    const rec = document.createElement("fieldset"); rec.id = "b56RecFieldset";
    rec.innerHTML = '<legend>📚 날짜별 점검 기록</legend><div id="b56RecList"></div><div class="b56-btns"><button type="button" class="reset-btn" id="b56SaveUpd">💾 수정 저장</button><button type="button" class="reset-btn" id="b56SaveNew">➕ 새 기록으로 저장</button><button type="button" class="photo-remove-btn" id="b56New">📝 새로 작성</button></div>';
    const firstFs = panel.querySelector("fieldset"); panel.insertBefore(rec, firstFs);
    // PDF 칸 다음: 협력사 서명
    const sig = document.createElement("fieldset"); sig.id = "b56SigFieldset";
    sig.innerHTML = '<legend>✍️ 협력사 서명 (완료 확인자 · 별지 6 제출자)</legend><p class="save-note" style="margin-top:0">한 번 등록하면 그 협력사가 조치한 줄마다 자동으로 들어가요.</p><div id="b56SigList"></div>';
    const pdfFs = document.getElementById("b5PdfFieldset"); pdfFs.parentNode.insertBefore(sig, pdfFs.nextSibling);
    // PDF 안내·검토 칸 문구 정리
    const note = pdfFs.querySelector(".save-note"); if(note) note.textContent = '안전팀 "추가위험발굴지시/조치" PDF(여러 건이 묶인 PDF도 돼요)를 올리면 건마다 지적 사진·조치 사진·내용을 읽어요. 소방 점검(임시소방시설·피난로 등·화기취급감독)에 해당하는 것만 기본으로 넣고, 지시일자별로 따로 기록을 만들어요.';
    ["b5-pdf-r-date", "b5-pdf-r-noticeno"].forEach(id => { const el = document.getElementById(id); const fr = el && el.closest(".field-row"); if(fr) fr.style.display = "none"; });
    const rv = document.getElementById("b5-pdf-review");
    rv.querySelectorAll(".save-note").forEach(p => { if(/별지 6/.test(p.textContent)) p.textContent = "📅 지시일자별로 따로 기록이 만들어져요 (별지 5·6 함께). 회색 항목은 소방 점검과 관계없어 보여서 빼 둔 것이에요. 넣으려면 체크하세요."; });
    document.getElementById("b56SaveUpd").addEventListener("click", ()=>{
      const r = b56Records.find(x => x.id === b56CurId); if(!r) return;
      Object.assign(r, b56Snapshot(), { savedAt: new Date().toISOString() }); b56Persist(); b56RenderRecs(); alert("저장했어요.");
    });
    document.getElementById("b56SaveNew").addEventListener("click", ()=>{
      const r = Object.assign({ id: "b56_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), savedAt: new Date().toISOString() }, b56Snapshot());
      b56Records.push(r); b56CurId = r.id; b56Persist(); b56RenderRecs(); alert("새 기록으로 저장했어요.");
    });
    document.getElementById("b56New").addEventListener("click", ()=>{
      if(!confirm("지금 화면을 비우고 새로 작성할까요? (저장된 기록은 지워지지 않아요)")) return;
      b56CurId = null; b56Apply({ date: "", rows5: [], rows6: [], meta5: {}, meta6: { confirmer: B5_FIXED_INSPECTOR } }); b56RenderRecs();
    });
    document.getElementById("b56RecList").addEventListener("click", (e)=>{
      const del = e.target.closest("[data-rdel]");
      if(del){ e.stopPropagation(); const r = b56Records.find(x => x.id === del.dataset.rdel); if(r && confirm(`${(r.date || "").replace(/-/g, ".")} 기록을 삭제할까요?`)){ b56Records = b56Records.filter(x => x !== r); if(b56CurId === r.id) b56CurId = null; b56Persist(); b56RenderRecs(); } return; }
      const it = e.target.closest("[data-rid]"); if(!it) return;
      const r = b56Records.find(x => x.id === it.dataset.rid); if(!r) return;
      b56CurId = r.id; b56Apply(r); b56RenderRecs();
    });
    // 검토 화면: "소방 점검에 넣기"를 바꾸면 흐리게/진하게
    document.getElementById("b5-pdf-review-list").addEventListener("change", (e)=>{ if(e.target.dataset && e.target.dataset.f === "include"){ const row = e.target.closest("[data-i]"); if(row) row.classList.toggle("b56-off", !e.target.checked); } });
    b56RenderSigs();
    b56Load();
  })();

"""

B56_PAGES_CSS = """
  /* 별지 5·6 인쇄용 A4 쪽 — 원래 서식(별지 5·6) 모양 그대로, 쪽 단위로 다시 그림 */
  #b56Main .b56-src{ display:none !important; }
  #b56Main .b56-page{ width:210mm; max-width:none; height:297mm; min-height:0; padding:14mm 13mm 12mm; box-sizing:border-box; margin:0 auto 20px; display:flex; flex-direction:column; }
  .b56-page .byeolji-header{ flex:none; margin-bottom:0; }
  .b56-page .ch1-table{ margin-top:0; table-layout:fixed; border:1.5px solid #333; }
  .b56-page .ch1-table th{ background:#dce6f1; border:1px solid #555; font-size:12.5px; padding:4px 3px; line-height:1.3; text-align:center; vertical-align:middle; word-break:keep-all; font-weight:700; }
  .b56-page .ch1-table td{ border:1px solid #777; font-size:12px; padding:4px 6px; line-height:1.45; word-break:keep-all; overflow-wrap:anywhere; vertical-align:middle; }
  .b56-page .ch1-table td.c{ text-align:center; }
  .b56-page .ch1-table td.r{ text-align:right; padding-right:3mm; }
  .b56-page .b56-meta{ flex:none; margin-top:3mm; }
  .b56-page .b56-meta th, .b56-page .b56-meta td{ height:9mm; white-space:nowrap; font-size:13px; }
  .b56-page .b56-fill{ flex:1 1 auto; min-height:0; margin-top:2.5mm; display:flex; flex-direction:column; }
  .b56-page .b56-fill > table{ flex:1 1 auto; height:100%; }
  .b56-page .b56-foot{ flex:none; margin-top:2.5mm; }
  .b56-page .b56-foot th, .b56-page .b56-foot td{ height:11mm; font-size:13px; }
  .b56-page .b56-sn{ display:inline-flex; align-items:center; gap:1mm; white-space:nowrap; }
  .b56-page .b56-sn img{ max-height:9mm; max-width:24mm; vertical-align:middle; }
  .b56-page .b56-sn .ph{ color:#333; }
  .b56-page .b56-kd{ font-size:11.5px; line-height:1.35; }
  .b56-page .b56-kd div{ display:flex; justify-content:space-between; white-space:nowrap; }
  .b56-page .b56-iss{ white-space:pre-line; }
  .b56-page .b56-t5 td.done{ text-align:center; padding:2px; }
  .b56-page .b56-t5 td.done .b56-sn{ flex-wrap:wrap; justify-content:center; white-space:normal; }
  .b56-page .b56-t6 tbody tr{ height:50%; }
  .b56-page .b56-t6 td.pc{ vertical-align:top; padding:2mm; }
  .b56-page .b56-t6 td.pc.iss{ vertical-align:middle; }
  .b56-page .b56-pbox{ display:flex; align-items:center; justify-content:center; }
  .b56-page .b56-pbox img{ display:block; max-width:100%; max-height:100%; object-fit:contain; }
  .b56-page .b56-t6 td.iss .b56-pbox{ height:60mm; margin-bottom:2mm; }
  .b56-page .b56-t6 td.res .b56-pbox{ height:86mm; }
  .b56-page .b56-txt{ margin-top:2mm; white-space:pre-line; font-size:11.5px; line-height:1.4; text-align:center; }
  @media print{
    #b56Main .b56-page{ margin:0 !important; height:296mm; box-shadow:none !important; overflow:hidden; }
    #b56Pages6 > .b56-page:first-child{ break-before:page; page-break-before:always; }
  }
"""

B56_PAGES_JS = r"""
  /* ---- 별지 5·6: 원래 서식 모양 그대로, A4 한 쪽을 꽉 채운 인쇄용 쪽 ---- */
  function b56Host(id, tbodyId){
    const tb = document.getElementById(tbodyId); const src = tb && tb.closest(".ch1-paper"); if(!src) return null;
    src.classList.add("b56-src");
    let h = document.getElementById(id);
    if(!h){ h = document.createElement("div"); h.id = id; h.className = "b56-pages"; src.parentNode.insertBefore(h, src.nextSibling); }
    return h;
  }
  function b56Chunk(a, n){ const out = []; for(let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out.length ? out : [[]]; }
  function b56DateKo(v){ const m = String(v || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : ""; }
  function b56OfficerSig(name){ try{ return String(name || "").replace(/\s/g, "") === B5_FIXED_INSPECTOR ? (localStorage.getItem(B3A_SIGNATURE_DEFAULT_KEY) || "") : ""; }catch(e){ return ""; } }
  // 이름 + 서명 (서명이 없으면 "(서명)" 자리)
  function b56NameSig(name, sig){
    name = String(name || "").trim(); if(!name) return "";
    return `<span class="b56-sn">${esc3a(name)}${sig ? `<img src="${sig}" alt="서명" />` : '<span class="ph">(서명)</span>'}</span>`;
  }
  function b56Items(t){ return String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean); }
  function b56IssueHtml(r){
    const pre = b6CompanyPrefix(r);
    return `<div class="b56-iss">· ${pre}${esc3a(String(r.issue || "").trim())}</div>`;
  }
  function b56PageHtml(badge, title, meta, body, foot){
    return `<div class="ch1-paper b56-page"><div class="byeolji-header"><div class="byeolji-badge">${badge}</div><div class="byeolji-title-box">${title}</div></div>${meta}<div class="b56-fill">${body}</div>${foot || ""}</div>`;
  }
  // 줄 높이 어림(mm): 지적사항 칸 글자 수로
  function b56RowMm(r){
    const cpl = 22, lines = b56Items((r.issue || "") + " " + ((r.company || "") + (r.trade || ""))).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0);
    return Math.max(15, lines * 4.4 + 3);
  }
  function b56Pages5(){
    const host = b56Host("b56Pages5", "b5TableBody"); if(!host) return;
    let m5 = {}; try{ m5 = JSON.parse(localStorage.getItem(B5_META_KEY) || "{}"); }catch(e){}
    const rows = b5Rows.filter(r => r.place || r.issue || r.doneBy || r.noticeNo || r.tempFacility || r.evacRoute || r.fireSupervise);
    const meta = `<table class="ch1-table b56-meta"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>점검일</th><td class="r">${b56DateKo(m5.date)}</td><th>점검자</th><td class="r">${b56NameSig(B5_FIXED_INSPECTOR, b56OfficerSig(B5_FIXED_INSPECTOR))}</td></tr></table>`;
    const head = `<colgroup><col style="width:10%"><col style="width:20%"><col><col style="width:16%"><col style="width:16%"></colgroup>`
      + `<thead><tr><th rowspan="3">장소<br>(구역)</th><th rowspan="3">점검종류</th><th rowspan="3">지적사항</th><th colspan="2">현장조치 결과</th></tr><tr><th>완료</th><th>불가</th></tr><tr><th>확인자</th><th>통보서 번호</th></tr></thead>`;
    const kd = r => `<div class="b56-kd"><div><span>■ 임시소방시설</span><span>(${r.tempFacility ? " ○ " : "  "})</span></div><div><span>■ 피난로 등</span><span>(${r.evacRoute ? " ○ " : "  "})</span></div><div><span>■ 화기취급감독</span><span>(${r.fireSupervise ? " ○ " : "  "})</span></div></div>`;
    const one = r => { const n = String(r.doneBy || "").trim();
      return `<tr style="height:${b56RowMm(r)}mm"><td class="c">${esc3a(r.place || "").replace(/\s*\(/, "<br/>(")}</td><td>${kd(r)}</td><td>${b56IssueHtml(r)}</td><td class="done">${n ? b56NameSig(n, b56SigOf(n)) : ""}</td><td class="c">${esc3a(r.noticeNo || "")}</td></tr>`; };
    const BODY = 216, BLANK = 15;   // 본문 높이(mm), 빈 줄 높이
    const pages = []; let cur = [], used = 0;
    rows.forEach(r => { const h = b56RowMm(r); if(cur.length && used + h > BODY){ pages.push([cur, used]); cur = []; used = 0; } cur.push(r); used += h; });
    pages.push([cur, used]);
    host.innerHTML = pages.map(([pr, u]) => b56PageHtml("별지 5", "안전점검 결과 지적내역서", meta,
      `<table class="ch1-table b56-t5">${head}<tbody>${pr.map(one).join("") + "<tr style=\"height:15mm\"><td></td><td></td><td></td><td></td><td></td></tr>".repeat(Math.max(0, Math.floor((BODY - u) / BLANK)))}</tbody></table>`)).join("");
  }
  function b56Pages6(){
    const host = b56Host("b56Pages6", "b6TableBody"); if(!host) return;
    let m6 = {}; try{ m6 = JSON.parse(localStorage.getItem(B6_META_KEY) || "{}"); }catch(e){}
    const rows = b6Rows.filter(r => r.place || r.kind || r.issue || r.result || r.photo || r.photoBefore);
    const meta = `<table class="ch1-table b56-meta"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>점검일</th><td class="r">${b56DateKo(m6.date)}</td><th>통보서 번호</th><td class="c">${esc3a(m6.noticeNo || "")}</td></tr></table>`;
    const head = `<colgroup><col style="width:9%"><col style="width:15%"><col style="width:30%"><col></colgroup><thead><tr><th>장소<br>(구역)</th><th>점검종류</th><th>지적사항</th><th>조치 결과 사진</th></tr></thead>`;
    const ph = u => u ? `<div class="b56-pbox"><img src="${u}" alt="" /></div>` : "";
    const kinds = r => String(r.kind || "").split(/\s*,\s*/).filter(Boolean).map(k => `<div>■ ${esc3a(k)}</div>`).join("");
    const one = r => `<tr><td class="c">${esc3a(r.place || "").replace(/\s*\(/, "<br/>(")}</td><td><div class="b56-kd">${kinds(r)}</div></td>`
      + `<td class="pc iss">${ph(r.photoBefore)}${b56IssueHtml(r)}</td>`
      + `<td class="pc res">${ph(r.photo)}${r.result ? `<div class="b56-txt">${esc3a(r.result)}</div>` : ""}</td></tr>`;
    const subs = String(m6.submitter || "").split(/\s*,\s*/).filter(Boolean).map(n => b56NameSig(n, b56SigOf(n))).join(" ");
    const foot = `<table class="ch1-table b56-foot"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>제출자</th><td class="r">${subs}</td><th>확인자</th><td class="r">${b56NameSig(m6.confirmer, b56OfficerSig(m6.confirmer))}</td></tr></table>`;
    host.innerHTML = b56Chunk(rows, 2).map(pr => b56PageHtml("별지 6", "안전점검 조치 결과 통보서", meta,
      `<table class="ch1-table b56-t6">${head}<tbody>${pr.map(one).join("") + "<tr><td></td><td></td><td></td><td></td></tr>".repeat(2 - pr.length)}</tbody></table>`, foot)).join("");
  }
"""

PAIRS = [
    # 한 화면 틀
    ('<!-- ============ FORM: 별지 9 소방시설 오동작 관리대장 ============ -->',
     COMBINED_HTML + '<!-- ============ FORM: 별지 9 소방시설 오동작 관리대장 ============ -->'),
    ('<script type="text/x-woomi-app">\n(function mergeB3(){', '<script type="text/x-woomi-app">\n' + MERGE_JS + '(function mergeB3(){'),
    ('    "byeolji-5": "byeolji5FormView",', '    "byeolji-5": "b56CombinedView",'),
    ('    "byeolji-6": "byeolji6FormView",', '    "byeolji-6": "b56CombinedView",'),
    # 메뉴·라우터
    ('''    <li><button class="gs-navlink" data-route="hotwork" onclick="location.hash='#hotwork'"><span class="gs-navicon">🔥</span> 화기작업 신청서·허가서</button></li>\n''',
     '''    <li><button class="gs-navlink" data-route="hotwork" onclick="location.hash='#hotwork'"><span class="gs-navicon">🔥</span> 화기작업 신청서·허가서</button></li>\n'''
     '''    <li><button class="gs-navlink" data-route="form/byeolji-5" onclick="location.hash='#form/byeolji-5'"><span class="gs-navicon">🛠</span> 안전점검 지적내역서·조치결과통보서</button></li>\n'''),
    ('    if(hash !== "form/byeolji-3-1" && hash !== "hotwork"){',
     '    if(hash === "form/byeolji-6") hash = "form/byeolji-5";\n    if(hash !== "form/byeolji-3-1" && hash !== "hotwork" && hash !== "form/byeolji-5"){'),
    ('소방안전 교육·훈련 · 화기작업 서류', '소방안전 교육·훈련 · 화기작업 · 안전점검 서류'),
    # 묶음 PDF 읽기
    ('''          const row = await b5ReadDispatchPdf(f);
          if(row) b5ImportRows.push(row); else failed.push(f.name);''',
     '''          const rows = await b56ReadAll(f);   // (WOOMI) 한 쪽에 여러 건인 묶음 PDF도
          if(rows.length) b5ImportRows.push(...rows); else failed.push(f.name);'''),
    ('''      b5SetPdfStatus(`✅ ${b5ImportRows.length}건을 읽었어요. 확인 후 "적용하기"를 눌러주세요.`''',
     '''      b5SetPdfStatus(`✅ ${b5ImportRows.length}건을 읽었어요 · 소방 점검 해당 ${b5ImportRows.filter(r => r.include !== false).length}건 · 지시일자 ${new Set(b5ImportRows.filter(r => r.include !== false).map(r => r._date)).size}일치. 확인 후 "적용하기"를 눌러주세요.`'''),
    # 검토 목록: 넣기 체크, 분류 표시, 지적·조치 사진
    ('''      <div class="rev-row-editor" data-i="${i}">
        <span class="rev-row-no">#${i+1}${r.docNo ? " · " + esc(r.docNo) : ""}</span>''',
     '''      <div class="rev-row-editor${r.include === false ? " b56-off" : ""}" data-i="${i}">
        <span class="rev-row-no"><label class="b56-inc"><input type="checkbox" data-f="include" ${r.include !== false ? "checked" : ""}/> 소방 점검에 넣기</label> · #${i+1}${r.docNo ? " · " + esc(r.docNo) : ""} · ${esc((r._date || "").replace(/-/g, "."))}${r.relevant ? "" : '<span class="b56-kindtag none">소방 무관</span>'}</span>'''),
    ('''        ${r.photo ? `<div class="photo-thumb-wrap" style="display:block"><img src="${r.photo}" class="photo-thumb" alt="조치 후 사진" />
          <label style="display:block;margin-top:4px"><input type="checkbox" data-f="usePhoto" ${r.usePhoto ? "checked" : ""}/> 이 사진을 별지 6 조치 결과에 넣기 (조치 후 사진)</label></div>` : ""}''',
     '''        ${(r.photoBefore || r.photo) ? `<div class="b56-photos"><figure>${r.photoBefore ? `<img src="${r.photoBefore}" alt="지적 사진" />` : ""}<figcaption>지적 사진</figcaption></figure><figure>${r.photo ? `<img src="${r.photo}" alt="조치 사진" />` : ""}<figcaption>${r.photo ? "조치 사진" : "조치 사진 없음"}</figcaption></figure></div>
          <label style="display:block;margin-top:2px"><input type="checkbox" data-f="usePhoto" ${r.usePhoto !== false ? "checked" : ""}/> 사진을 별지 6에 넣기</label>` : ""}'''),
    ('''        <div class="field"><label>완료(확인자)</label><input type="text" data-f="doneBy" value="${esc(r.doneBy)}" /></div>''',
     '''        <div class="field"><label>완료(확인자 = 조치한 협력사)</label><input type="text" data-f="doneBy" value="${esc(r.doneBy)}" placeholder="미조치면 비워 두세요" /></div>'''),
    # 적용하기 → 날짜별 기록
    ('''  document.getElementById("b5-pdf-apply").addEventListener("click", ()=>{
    if(!b5ImportRows.length) return;''',
     '''  document.getElementById("b5-pdf-apply").addEventListener("click", ()=>{
    if(!b5ImportRows.length) return;
    if(window.b56ApplyImport){ window.b56ApplyImport(); return; }'''),
    # 미리보기: 완료(확인자) 서명, 별지 6 사진 2장, 제출자 서명
    ('''        <td>${r.doneBy||""}</td>''', '''        <td style="text-align:center">${b56DoneCell(r)}</td>'''),
    ('''<td style="white-space:pre-line">${r.photo ? `<img src="${r.photo}" class="b6-result-photo" alt="조치 사진" />` : ""}${r.result||""}</td></tr>`).join("");''',
     '''<td style="white-space:pre-line">${b56ResultCell(r)}</td></tr>`).join("");'''),
    ('''    document.getElementById("b6-pv-submitter").textContent = meta.submitter || "\\u00A0";''',
     '''    document.getElementById("b6-pv-submitter").innerHTML = b56SubmitterCell(meta.submitter);'''),
    # 별지 5 행을 고치면 서명 목록도 다시
    ('''        b5Rows[i][f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        saveB5Rows(); renderB5Preview();''',
     '''        b5Rows[i][f] = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        saveB5Rows(); renderB5Preview(); if(f === "doneBy" || f === "company"){ try{ b56RenderSigs(); }catch(err){} }'''),
    # CSS
    ('  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }',
     B56_CSS + '  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }'),
    # 새 코드: 앱 시작 직전
    ('<style>\n  /* 화면 미리보기도 인쇄와 똑같이: A4 한 장씩 따로, 같은 여백 */', '<style>' + B56_PAGES_CSS + '</style>\n<style>\n  /* 화면 미리보기도 인쇄와 똑같이: A4 한 장씩 따로, 같은 여백 */'),
    ('  load();\n  wireHomeCoverInputs();', B56_JS + B56_PAGES_JS + '  load();\n  wireHomeCoverInputs();'),
    ('    }).join("");\n    renderDashboard();\n  }\n  document.getElementById("b5AddBtn")', '    }).join("");\n    try{ b56Pages5(); }catch(e){}\n    renderDashboard();\n  }\n  document.getElementById("b5AddBtn")'),
    ('\n  }\n  document.getElementById("b6AddBtn")', '\n    try{ b56Pages6(); }catch(e){}\n  }\n  document.getElementById("b6AddBtn")'),
]

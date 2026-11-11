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
  #b56SelStatus:empty{ display:none; }
  #b56RecList .b56-rec input[type=checkbox]{ flex:none; margin:0 2px 0 0; width:16px; height:16px; cursor:pointer; }
  #b56RecList .b56-rec span{ flex:1; min-width:0; color:#5a6272; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #b56RecList .b56-rec button{ flex:none; border:0; background:none; color:#c0392b; cursor:pointer; }
  .b56-btns{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; }
  .b56-btns button{ flex:1 1 0; min-width:0; margin:0 !important; padding-left:4px; padding-right:4px; font-size:12px; white-space:nowrap; }
  /* 검토 목록 머리줄(넣기 체크 · 번호 · 문서번호 · 날짜)이 입력칸 위에 겹치지 않게 한 줄 따로 */
  #b5-pdf-review-list .rev-row-editor .rev-row-no{ position:static; display:flex; flex-wrap:wrap; align-items:center; gap:2px 6px; margin:-2px 0 10px; padding-bottom:8px; border-bottom:1px dashed #d5dbe5; font-size:12px; line-height:1.5; color:#5a6272; }
  #b5-pdf-review-list .rev-row-editor .rev-row-no input{ margin:0 3px 0 0; vertical-align:-2px; }
  #b5-pdf-review-list textarea[data-f="issue"]{ min-height:150px; }
  #b5-pdf-review-list textarea[data-f="result"]{ min-height:64px; }
  .rev-row-editor.b56-off{ opacity:.45; }
  .rev-row-editor.b56-off textarea, .rev-row-editor.b56-off input[type=text]{ background:#f4f5f7; }
  .b56-inc{ font-weight:700; color:#27407f; }
  .b56-kindtag{ display:inline-block; font-size:11px; padding:1px 6px; border-radius:10px; background:#eef3ff; color:#27407f; margin-left:4px; }
  .b56-kindtag.none{ background:#f1f2f4; color:#8a92a3; }
  .b56-photos{ display:flex; gap:6px; margin:6px 0; }
  .b56-photos figure{ flex:1; margin:0; text-align:center; font-size:11px; color:#5a6272; }
  .b56-photos img{ width:100%; height:92px; object-fit:contain; background:#f7f8fa; border:1px solid #e2e5ea; border-radius:4px; }
  .b56-siggrp{ margin-bottom:10px; }
  .b56-siggrp-t{ font-size:12.5px; font-weight:700; color:#27407f; margin:4px 0 6px; padding-bottom:3px; border-bottom:1px solid #e3e7ef; }
  .b56-siggrp-t span{ font-weight:500; color:#8a92a3; font-size:11.5px; margin-left:4px; }
  .b56-sigrow{ display:grid; grid-template-columns:minmax(0, 1fr) 92px 170px; gap:6px; align-items:center; margin-bottom:6px; font-size:13px; }
  .b56-sigrow .sig{ height:34px; border:1px dashed #c5cbd6; border-radius:6px; background:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; color:#98a2b3; overflow:hidden; }
  .b56-sigrow .sig img{ max-height:30px; max-width:88px; }
  .b56-sigrow .sig{ cursor:pointer; }
  .b56-sigrow.armed .sig{ border:1.5px solid #2451c9; background:#eef3ff; color:#2451c9; }
  .b56-pastebox{ margin:-2px 0 8px; padding:8px 10px; border:1.5px solid #2451c9; border-radius:8px; background:#eef3ff; font-size:12px; color:#27407f; outline:none; }
  /* 버튼 3칸(서명·사진·삭제)을 같은 크기로, 삭제가 없어도 자리는 비워 두어 줄이 딱 맞게 */
  .b56-sigrow .acts{ display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; }
  .b56-sigrow .acts > button, .b56-sigrow .acts > .b56-slot{ box-sizing:border-box; width:100% !important; height:32px !important; min-height:0 !important; margin:0 !important; padding:0 4px !important; font-size:11.5px !important; font-weight:600; line-height:1 !important; border-radius:7px !important; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; }
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
          doneBy: done ? (String(d["조치자"] || "").trim() || row.company || "") : "", _done: done, _doneDate: b56Ymd(d["조치일자"]),   // 확인자 = 안전 서류의 조치자
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
      let ch = false; b56Records.forEach(r => { if(b56Migrate(r)) ch = true; }); if(b56Renumber()) ch = true;
      if(ch) b56Persist();
    }catch(e){ console.warn(e); b56Records = []; }
    b56RenderRecs();
  }
  // 통보서 번호 = 별지 6 점검일(조치 완료일)-순번. 같은 날 여러 기록이면 01, 02, ... (직접 다른 형식으로 쓴 번호는 그대로)
  function b56Renumber(){
    // 통보서 번호 = 별지 6 점검일(조치 완료일) + 일련번호. 일련번호는 날짜 순으로 01, 02, 03 … 계속 이어짐
    // (직접 다른 형식으로 쓴 번호는 그대로 두고 순번에서 뺌)
    let ch = false; const auto = /^\d{4}-\d{2}-\d{2}-\d{2,}$/;
    const list = b56Records.filter(r => { r.meta6 = r.meta6 || {}; const n = String(r.meta6.noticeNo || "").trim(); return (!n || auto.test(n)) && (r.meta6.date || r.date); });
    const key = r => b56Ymd(r.meta6.date || r.date) || "9999-99-99";
    list.sort((a, b) => key(a).localeCompare(key(b)) || String(b56Ymd(a.date) || "").localeCompare(String(b56Ymd(b.date) || "")) || String(a.id || "").localeCompare(String(b.id || "")));
    list.forEach((r, i) => {
      const no = `${key(r)}-${String(i + 1).padStart(2, "0")}`;
      if(r.meta6.noticeNo === no) return;
      r.meta6.noticeNo = no; ch = true;
      (r.rows5 || []).forEach(x => { if(x.noticeNo && auto.test(String(x.noticeNo).trim())) x.noticeNo = no; });
    });
    return ch;
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
  function b56Ymd(v){ const m = String(v || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m ? `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}` : ""; }
  // 별지 6 점검일 = 조치 완료일(가장 늦은 날)
  function b56DoneDate(rows6){ const ds = (rows6 || []).map(r => r.doneDate || b56Ymd((String(r.result || "").match(/조치\s*완료\s*\(([^,)]+)/) || [])[1])).filter(Boolean).sort(); return ds.length ? ds[ds.length - 1] : ""; }
  function b56Snapshot(){
    const m5 = b56Meta(B5_META_KEY), m6 = b56Meta(B6_META_KEY);
    return { date: m5.date || m6.date || "", rows5: JSON.parse(JSON.stringify(b5Rows)), rows6: JSON.parse(JSON.stringify(b6Rows)), meta5: m5, meta6: m6 };
  }
  // 예전 기록(확인자·제출자에 협력사명만 있던 것) → 조치 결과의 "조치자: 이름"으로 바꿔 줌
  function b56Migrate(rec){
    let ch = false; const r5s = rec.rows5 || [], r6s = rec.rows6 || [];
    r5s.forEach(r5 => {
      const d = String(r5.doneBy || "").trim(); if(!d || d !== String(r5.company || "").trim()) return;
      const r6 = r6s.find(x => x.docNo && x.docNo === r5.docNo); const m = r6 && String(r6.result || "").match(/조치자:\s*([^,)\n]+)/);
      if(m && m[1].trim()){ r5.doneBy = m[1].trim(); ch = true; }
    });
    if(ch && rec.meta6){
      const cos = new Set(r5s.map(r => String(r.company || "").trim()));
      const sub = String(rec.meta6.submitter || "").split(/\s*,\s*/).filter(Boolean);
      if(!sub.length || sub.every(n => cos.has(n))) rec.meta6.submitter = [...new Set(r5s.map(r => String(r.doneBy || "").trim()).filter(Boolean))].join(", ");
    }
    if(rec.meta6 && (!rec.meta6.date || rec.meta6.date === rec.date)){ const dd = b56DoneDate(r6s); if(dd && dd !== rec.meta6.date){ rec.meta6.date = dd; ch = true; } }
    return ch;
  }
  function b56Apply(rec){
    if(b56Migrate(rec)){ try{ b56Persist(); }catch(e){} }
    b5Rows = JSON.parse(JSON.stringify(rec.rows5 && rec.rows5.length ? rec.rows5 : [{place:"",tempFacility:false,evacRoute:false,fireSupervise:false,issue:"",doneBy:"",noticeNo:""}]));
    b6Rows = JSON.parse(JSON.stringify(rec.rows6 && rec.rows6.length ? rec.rows6 : [{place:"",kind:"",issue:"",result:""}]));
    localStorage.setItem(B5_META_KEY, JSON.stringify(Object.assign({}, rec.meta5 || {}, { date: rec.date || "" })));
    localStorage.setItem(B6_META_KEY, JSON.stringify(Object.assign({ date: rec.date || "" }, rec.meta6 || {})));
    saveB5Rows(); saveB6Rows(); loadB5Meta(); loadB6Meta(); renderB5Form(); renderB6Form(); b56RenderSigs();
  }
  function b56RenderRecs(){
    const wrap = document.getElementById("b56RecList"); if(!wrap) return;
    const list = b56Records.slice().sort((x, y)=> String(y.date).localeCompare(String(x.date)));
    wrap.innerHTML = list.length ? list.map(r => {
      const cos = [...new Set((r.rows5 || []).map(x => x.company).filter(Boolean))].join(", ");
      return `<div class="b56-rec${r.id === b56CurId ? " on" : ""}" data-rid="${r.id}"><input type="checkbox" data-rsel="${r.id}" title="인쇄·PDF에 넣기" ${b56Sel.has(r.id) ? "checked" : ""}/><b>${esc3a((r.date || "날짜 없음").replace(/-/g, "."))}</b><span>${(r.rows5 || []).length}건 · ${esc3a(cos)}</span><button type="button" data-rdel="${r.id}" title="이 기록 삭제">✕</button></div>`;
    }).join("") : '<p class="save-note" style="margin:0">저장된 점검 기록이 없어요. PDF를 불러오면 날짜별로 저장돼요.</p>';
    [...b56Sel].forEach(id => { if(!b56Records.some(r => r.id === id)) b56Sel.delete(id); });
    const cnt = document.getElementById("b56RecCount"); if(cnt) cnt.textContent = `(${b56Records.length}건 · 체크 ${b56Sel.size}건)`;
    document.getElementById("b56SaveUpd").disabled = !b56CurId;
    const tu = document.getElementById("b56TopUpd"); if(tu) tu.style.display = b56CurId ? "" : "none";
    try{ b56RenderSigs(); }catch(e){}   // 기록이 바뀌면 서명 명단도
  }
  // ---- 협력사 서명 ----
  const B56_SIG_KEY = "fireplan_co_sigs_v1";
  function b56Sigs(){ try{ const o = JSON.parse(localStorage.getItem(B56_SIG_KEY) || "{}"); return o && typeof o === "object" ? o : {}; }catch(e){ return {}; } }
  function b56SetSig(name, url){ const o = b56Sigs(); if(url) o[name] = url; else delete o[name]; try{ localStorage.setItem(B56_SIG_KEY, JSON.stringify(o)); }catch(e){ alert("서명을 저장하지 못했어요."); } b56RenderSigs(); renderB5Preview(); renderB6Preview(); }
  function b56SigOf(name){ name = String(name || "").trim(); if(!name) return ""; const o = b56Sigs(); if(o[name]) return o[name]; if(name.replace(/\s/g, "") === B5_FIXED_INSPECTOR){ try{ return localStorage.getItem(B3A_SIGNATURE_DEFAULT_KEY) || ""; }catch(e){} } return ""; }
  function b56RenderSigs(){
    const wrap = document.getElementById("b56SigList"); if(!wrap) return;
    // 모든 날짜 기록 + 지금 화면의 조치자(확인자·제출자)를 협력사별로 모아서 보여 줌
    let m6 = {}; try{ m6 = JSON.parse(localStorage.getItem(B6_META_KEY) || "{}"); }catch(e){}
    const coOf = new Map();
    const add = (n, c) => { n = String(n || "").trim(); if(!n) return; c = String(c || "").trim(); if(c === n) c = ""; if(!coOf.has(n) || (!coOf.get(n) && c)) coOf.set(n, c); };
    b56Records.forEach(r => { (r.rows5 || []).forEach(x => add(x.doneBy, x.company)); String((r.meta6 || {}).submitter || "").split(/\s*,\s*/).forEach(n => add(n, "")); });
    b5Rows.forEach(x => add(x.doneBy, x.company));
    String(m6.submitter || "").split(/\s*,\s*/).forEach(n => add(n, ""));
    Object.keys(b56Sigs()).forEach(n => add(n, ""));
    coOf.delete(B5_FIXED_INSPECTOR);
    const groups = new Map([["소방안전관리자 (점검자 · 별지 6 확인자)", [B5_FIXED_INSPECTOR]]]);
    [...coOf.entries()].sort((x, y) => (x[1] || "힣").localeCompare(y[1] || "힣") || x[0].localeCompare(y[0])).forEach(([n, c]) => {
      const g = c || "기타 (협력사 모름)"; if(!groups.has(g)) groups.set(g, []); groups.get(g).push(n);
    });
    const names = [...groups.values()].flat();
    let idx = 0;
    const row = n => { const i = idx++, s = b56SigOf(n), armed = b56PasteName === n;
      const hint = armed ? `<div class="b56-pastebox" tabindex="-1" data-pbox="${i}">📋 <b>지금 Ctrl+V</b>를 누르면 복사한 서명 사진(화면 캡처)이 들어가요.<div class="b56-btns" style="margin-top:6px"><button type="button" class="reset-btn" data-sfile="${i}">📁 파일에서 찾기</button><button type="button" class="photo-remove-btn" data-scancel="1">취소</button></div></div>` : "";
      return `<div class="b56-sigrow${armed ? " armed" : ""}"><span>${esc3a(n)}</span><span class="sig" data-sup="${i}" title="누르고 Ctrl+V로 붙여넣기">${s ? `<img src="${s}" alt="서명">` : "서명 없음"}</span><span class="acts"><button type="button" class="reset-btn" data-sdraw="${i}">✍️ 서명</button><button type="button" class="reset-btn" data-sup="${i}">🖼 사진</button>${s && b56Sigs()[n] ? `<button type="button" class="photo-remove-btn" data-sdel="${i}">삭제</button>` : `<span class="b56-slot"></span>`}</span></div>${hint}`; };
    wrap.innerHTML = names.length ? [...groups.entries()].map(([g, ns]) => `<div class="b56-siggrp"><div class="b56-siggrp-t">${esc3a(g)} <span>${ns.filter(n => b56SigOf(n)).length}/${ns.length}명 등록</span></div>${ns.map(row).join("")}</div>`).join("")
      : '<p class="save-note" style="margin:0">PDF를 불러오면 조치자 이름이 여기에 나와요.</p>';
    wrap.querySelectorAll("[data-sdraw]").forEach(b => b.addEventListener("click", ()=> b56OpenPad(names[+b.dataset.sdraw])));
    wrap.querySelectorAll("[data-sdel]").forEach(b => b.addEventListener("click", ()=>{ if(confirm(names[+b.dataset.sdel] + " 서명을 지울까요?")) b56SetSig(names[+b.dataset.sdel], ""); }));
    // 🖼 사진 / 서명 칸 → 바로 파일 창을 열지 않고 "Ctrl+V 붙여넣기" 대기 (파일 찾기는 안내 안의 버튼)
    wrap.querySelectorAll("[data-sup]").forEach(b => b.addEventListener("click", ()=>{ b56PasteName = names[+b.dataset.sup]; b56RenderSigs(); }));
    wrap.querySelectorAll("[data-scancel]").forEach(b => b.addEventListener("click", ()=>{ b56PasteName = null; b56RenderSigs(); }));
    wrap.querySelectorAll("[data-sfile]").forEach(b => b.addEventListener("click", ()=>{
      const name = names[+b.dataset.sfile];
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = ()=>{ const f = inp.files[0]; if(f) b56SigFromFile(name, f); };
      inp.click();
    }));
    const pb = wrap.querySelector("[data-pbox]"); if(pb){ pb.focus({ preventScroll: true }); }
  }
  // 서명 붙여넣기 대기 중인 사람
  let b56PasteName = null;
  // 사진(파일·붙여넣기) → 흰 바탕의 서명 글씨만 뽑아 저장
  function b56SigFromFile(name, f){
    const im = new Image();
    im.onload = ()=>{
      const c = document.createElement("canvas"); const k = Math.min(1, 900 / im.width); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(im.src);
      const ink = b3aTrInk(c, true);
      if(!ink){ alert("서명을 찾지 못했어요. 흰 바탕에 서명만 보이게 캡처해서 다시 넣어주세요."); return; }
      b56PasteName = null; b56SetSig(name, ink.url);
    };
    im.onerror = ()=> alert("사진을 읽지 못했어요.");
    im.src = URL.createObjectURL(f);
  }
  document.addEventListener("paste", (e)=>{
    if(!b56PasteName) return;
    const view = document.getElementById("b56CombinedView"); if(!view || view.classList.contains("view-hidden")) return;
    const items = [...((e.clipboardData && e.clipboardData.items) || [])];
    const it = items.find(x => x.kind === "file" && /^image\//.test(x.type));
    if(!it){ alert("복사된 사진이 없어요. 화면 캡처(Print Screen, 또는 Windows+Shift+S)로 서명 부분을 복사한 뒤 다시 Ctrl+V 해주세요."); return; }
    e.preventDefault();
    b56SigFromFile(b56PasteName, it.getAsFile());
  });
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
      const cos = [...new Set(rows.map(r => (r.doneBy || "").trim()).filter(Boolean))];   // 별지 6 제출자 = 조치자
      const rows5 = rows.map(r => ({ company: r.company || "", trade: r.trade || "", place: r.place || "",
        tempFacility: !!r.tempFacility, evacRoute: !!r.evacRoute, fireSupervise: !!r.fireSupervise,
        issue: r.issue || "", doneBy: r.doneBy || "", noticeNo: r._done ? "" : notice, docNo: r.docNo || "" }));
      const rows6 = rows.map(r => ({ company: r.company || "", trade: r.trade || "", place: r.place || "", kind: b5KindText(r),
        issue: r.issue || "", result: r.result || "", doneDate: r._doneDate || "", photo: r.usePhoto !== false ? (r.photo || "") : "", photoBefore: r.usePhoto !== false ? (r.photoBefore || "") : "", docNo: r.docNo || "" }));
      let rec = b56Records.find(x => x.date === date);
      if(rec){   // 같은 날짜 기록이 있으면 문서번호로 합치기
        rows5.forEach(n5 => { const ex = rec.rows5.find(x => x.docNo && x.docNo === n5.docNo); if(ex) Object.assign(ex, n5); else rec.rows5.push(n5); });
        rows6.forEach(n6 => { const ex = rec.rows6.find(x => x.docNo && x.docNo === n6.docNo); if(ex) Object.assign(ex, n6); else rec.rows6.push(n6); });
        rec.meta6 = Object.assign({}, rec.meta6, { submitter: [...new Set(rec.rows5.map(x => (x.doneBy || "").trim()).filter(Boolean))].join(", "), date: b56DoneDate(rec.rows6) || (rec.meta6 && rec.meta6.date) || date });
        rec.savedAt = new Date().toISOString(); merged++;
      }else{
        rec = { id: "b56_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), savedAt: new Date().toISOString(), date,
          rows5, rows6, meta5: { date, inspector: B5_FIXED_INSPECTOR }, meta6: { date: b56DoneDate(rows6) || date, noticeNo: notice, submitter: cos.join(", "), confirmer } };
        b56Records.push(rec); made++;
      }
      last = rec;
    });
    b56Renumber();
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
    rec.innerHTML = '<legend>📚 날짜별 점검 기록 <span id="b56RecCount" style="font-weight:500;color:#5a6272"></span></legend>'
      + '<div class="b56-btns" style="margin:0 0 8px"><button type="button" class="reset-btn" id="b56SelAll">전체 선택</button><button type="button" class="reset-btn" id="b56SelNone">선택 해제</button></div>'
      + '<div id="b56RecList"></div>'
      + '<div class="b56-btns"><button type="button" class="reset-btn" id="b56PrintSel">🖨️ 체크한 기록 모두 인쇄</button><button type="button" class="reset-btn" id="b56PdfSel">📄 체크한 기록 날짜별 PDF</button></div><p class="save-note" id="b56SelStatus" style="margin:6px 0 0;min-height:0"></p>'
      + '<div class="b56-btns"><button type="button" class="reset-btn" id="b56SaveUpd">💾 수정 저장</button><button type="button" class="reset-btn" id="b56SaveNew">➕ 새로 저장</button><button type="button" class="photo-remove-btn" id="b56New">📝 새로 작성</button></div>';
    const firstFs = panel.querySelector("fieldset"); panel.insertBefore(rec, firstFs);
    // PDF 칸 다음: 협력사 서명
    const sig = document.createElement("fieldset"); sig.id = "b56SigFieldset";
    sig.innerHTML = '<legend>✍️ 서명 등록 (조치자 · 확인자 · 점검자)</legend><p class="save-note" style="margin-top:0">사람마다 한 번만 등록하면, 그 사람 이름이 들어가는 칸(별지 5 완료 확인자, 별지 6 제출자·확인자, 점검자)에 앞으로 계속 자동으로 날인돼요.</p><div id="b56SigList"></div>';
    const pdfFs = document.getElementById("b5PdfFieldset"); pdfFs.parentNode.insertBefore(sig, pdfFs.nextSibling);
    // PDF 안내·검토 칸 문구 정리
    const note = pdfFs.querySelector(".save-note"); if(note) note.textContent = '안전팀 "추가위험발굴지시/조치" PDF(여러 건이 묶인 PDF도 돼요)를 올리면 건마다 지적 사진·조치 사진·내용을 읽어요. 소방 점검(임시소방시설·피난로 등·화기취급감독)에 해당하는 것만 기본으로 넣고, 지시일자별로 따로 기록을 만들어요.';
    ["b5-pdf-r-date", "b5-pdf-r-noticeno"].forEach(id => { const el = document.getElementById(id); const fr = el && el.closest(".field-row"); if(fr) fr.style.display = "none"; });
    const rv = document.getElementById("b5-pdf-review");
    rv.querySelectorAll(".save-note").forEach(p => { if(/별지 6/.test(p.textContent)) p.textContent = "📅 지시일자별로 따로 기록이 만들어져요 (별지 5·6 함께). 회색 항목은 소방 점검과 관계없어 보여서 빼 둔 것이에요. 넣으려면 체크하세요."; });
    document.getElementById("b56SelAll").addEventListener("click", ()=>{ b56Records.forEach(r => b56Sel.add(r.id)); b56RenderRecs(); });
    document.getElementById("b56SelNone").addEventListener("click", ()=>{ b56Sel.clear(); b56RenderRecs(); });
    document.getElementById("b56PrintSel").addEventListener("click", b56PrintSelected);
    document.getElementById("b56PdfSel").addEventListener("click", b56PdfSelected);
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
      const sel = e.target.closest("[data-rsel]");
      if(sel){ e.stopPropagation(); if(sel.checked) b56Sel.add(sel.dataset.rsel); else b56Sel.delete(sel.dataset.rsel); b56RenderRecs(); return; }
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
  @media screen{
    #b56CombinedView:not(.view-hidden){ display:grid; grid-template-columns:minmax(340px, 420px) minmax(0, 1fr); grid-template-rows:58px minmax(0, 1fr); height:100vh; min-height:0; align-items:stretch; }
    #b56Top{ grid-column:1 / -1; display:flex; align-items:center; gap:10px; padding:0 18px; background:linear-gradient(180deg,#1d2d52,#14213d); color:#fff; box-shadow:0 2px 10px rgba(0,0,0,.25); z-index:5; }
    #b56Top .b56-logo{ width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,#ff8a4c,#e2562b); display:flex; align-items:center; justify-content:center; font-size:17px; flex:none; }
    #b56Top .b56-brand{ background:none; border:0; padding:0; margin:0; box-shadow:none; }
    #b56Top .b56-brand b{ display:block; font-size:15.5px; letter-spacing:-.2px; }
    #b56Top .b56-brand span{ display:block; font-size:11.5px; color:#9fb0d6; margin-top:1px; }
    #b56Top .sp{ flex:1; }
    #b56Top .tb{ display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.22); background:rgba(255,255,255,.07); color:#fff; padding:8px 12px; border-radius:9px; font:inherit; font-size:13px; cursor:pointer; white-space:nowrap; }
    #b56Top .tb:hover{ background:rgba(255,255,255,.16); }
    #b56Top .tb.pri{ background:#e2562b; border-color:#e2562b; font-weight:700; }
    #b56Top .tb:disabled{ opacity:.6; cursor:default; }
    .b56-i{ width:16px; height:16px; stroke:currentColor; fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; flex:none; }
    #b56CombinedView > #b56Panel{ position:relative !important; top:auto !important; height:auto !important; max-height:none !important; min-height:0; overflow-y:auto !important; padding-top:0 !important; padding-bottom:0 !important; }
    #b56Panel #b56Tabs{ position:sticky; top:0; z-index:4; background:#fff; margin:0 -22px 12px; padding:6px 22px 0; }
    #b56Panel .b56-pane{ padding-bottom:24px; }
    #b56Panel #b56SaveBar{ position:sticky; bottom:0; z-index:4; background:#fff; margin:14px -22px 0 !important; padding:10px 22px 12px; border-top:1px solid #e3e7ef; box-shadow:0 -6px 14px rgba(16,24,40,.06); }
    #b56CombinedView > #b56Main{ min-height:0; height:auto; overflow:auto; padding-top:22px; }
    #b56Main > .preview-toolbar{ display:none !important; }
  }
  @media print{ #b56Top{ display:none !important; } }
  .b56-tabs{ display:flex; gap:4px; margin:0 0 12px; border-bottom:1px solid var(--line,#dfe4ec); }
  .b56-tab{ flex:1; padding:10px 6px 11px; border:0; background:transparent; font:inherit; font-size:13.5px; font-weight:600; color:#8a93a3; cursor:pointer; border-bottom:3px solid transparent; margin-bottom:-1px; }
  .b56-tab.on{ color:#1e3a8a; border-bottom-color:#e8541f; }
  .b56-pane{ display:none; }
  .b56-pane.on{ display:block; }
  .b56-pane fieldset{ min-width:0; box-sizing:border-box; }
  .b56-page{ width:210mm; max-width:none; height:297mm; min-height:0; padding:14mm 13mm 12mm; box-sizing:border-box; margin:0 auto 20px; display:flex; flex-direction:column; }
  .b56-page .byeolji-header{ flex:none; margin-bottom:0; }
  .b56-page .ch1-table{ margin-top:0; table-layout:fixed; border:1.5px solid #333; }
  .b56-page .ch1-table th{ background:#dce6f1; border:1px solid #555; font-size:12.5px; padding:4px 3px; line-height:1.3; text-align:center; vertical-align:middle; word-break:keep-all; font-weight:700; }
  .b56-page .ch1-table td{ border:1px solid #777; font-size:12px; padding:4px 6px; line-height:1.45; word-break:keep-all; overflow-wrap:anywhere; vertical-align:middle; }
  .b56-page .ch1-table td.c{ text-align:center; }
  .b56-page .ch1-table td.r{ text-align:right; padding-right:6mm; }   /* 겹쳐 찍은 서명이 칸 밖으로 안 나가게 */
  .b56-page .b56-meta{ flex:none; margin-top:3mm; }
  .b56-page .b56-meta th, .b56-page .b56-meta td{ height:9mm; white-space:nowrap; font-size:13px; }
  .b56-page .b56-fill{ flex:1 1 auto; min-height:0; margin-top:2.5mm; display:flex; flex-direction:column; }
  .b56-page .b56-fill > table{ flex:1 1 auto; height:100%; }
  .b56-page .b56-foot{ flex:none; margin-top:2.5mm; }
  .b56-page .b56-foot th, .b56-page .b56-foot td{ height:11mm; font-size:13px; }
  .b56-page .b56-sn{ display:inline-flex; align-items:center; gap:1mm; white-space:nowrap; }
  .b56-page .b56-sn img{ max-height:9mm; max-width:24mm; vertical-align:middle; }
  .b56-page .b56-sn .ph{ color:#333; }
  .b56-page .b56-signed{ position:relative; display:inline-block; }
  .b56-page .b56-sn .b56-signed img{ position:absolute; left:50%; top:50%; transform:translate(-50%, -50%); max-height:8mm; max-width:19mm; width:auto; height:auto; pointer-events:none; z-index:1; }
  .b56-page .b56-kd{ font-size:11.5px; line-height:1.35; }
  .b56-page .b56-kd div{ display:flex; justify-content:space-between; align-items:flex-start; gap:2px; padding-left:1em; text-indent:-1em; }
  .b56-page .b56-kd div span:first-child{ flex:1 1 auto; min-width:0; }
  .b56-page .b56-kd div span + span{ flex:none; white-space:nowrap; text-indent:0; }
  .b56-page .b56-kd6{ font-size:11.5px; line-height:1.4; }
  .b56-page .b56-t6 td:nth-child(2){ padding-left:4px; padding-right:3px; }
  .b56-page .b56-kd6 div{ padding-left:1.1em; text-indent:-1.1em; word-break:keep-all; overflow-wrap:break-word; }
  .b56-page .ch1-table td.pl{ word-break:keep-all; overflow-wrap:break-word; padding-left:3px; padding-right:3px; }
  .b56-page .b56-iss{ white-space:pre-line; }
  .b56-page .b56-t5 td.done .b56-co{ font-size:11px; color:#333; margin-bottom:.5mm; }
  .b56-page .b56-t5 td.done{ text-align:center; padding:2px; }
  .b56-page .b56-t5 td.done .b56-sn{ flex-wrap:wrap; justify-content:center; white-space:normal; }
  .b56-page .b56-t6 tbody tr{ height:50%; }
  .b56-page .b56-t6 td.pc{ vertical-align:top; padding:2mm; }
  .b56-page .b56-t6 td.pc.iss{ vertical-align:middle; }
  .b56-page .b56-pbox{ display:flex; align-items:center; justify-content:center; }
  .b56-page .b56-pbox img{ display:block; max-width:100%; max-height:100%; object-fit:contain; }
  .b56-page .b56-t6 td.iss .b56-pbox{ height:72mm; margin-bottom:2mm; }
  .b56-page .b56-t6 td.res .b56-pbox{ height:92mm; }
  .b56-page .b56-txt{ margin-top:2mm; white-space:pre-line; font-size:11.5px; line-height:1.4; text-align:center; }
  @media print{
    .b56-page{ margin:0 !important; height:296mm; box-shadow:none !important; overflow:hidden; }
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
    // 실제 서명처럼: "(서명)" 글씨는 남기고 그 위에 서명을 겹쳐 찍음
    return `<span class="b56-sn">${esc3a(name)}<span class="b56-signed"><span class="ph">(서명)</span>${sig ? `<img src="${sig}" alt="서명" />` : ""}</span></span>`;
  }
  // 조치자 이름 → 그 사람의 협력사 (별지 5 줄에서 찾음)
  function b56CoOf(name, rows5){ name = String(name || "").trim(); const r = (rows5 || b5Rows).find(x => String(x.doneBy || "").trim() === name && x.company); const c = r ? String(r.company).trim() : ""; return c && c !== name ? c : ""; }
  function b56Items(t){ return String(t || "").split(/\n+/).map(x => x.trim()).filter(Boolean); }
  function b56IssueHtml(r){
    const t = [r.company, r.trade].map(v => String(v || "").trim()).filter(Boolean).join(" · ");
    return `<div class="b56-iss">· ${t ? `<b>[${esc3a(t)}]</b>\n` : ""}${esc3a(String(r.issue || "").trim())}</div>`;
  }
  // 장소: "1층 근로자휴게실" → "1층 근로자 휴게실" (낱말 단위로 줄바꿈되게)
  function b56Place(v){
    return esc3a(String(v || "").trim().replace(/([가-힣])(휴게실|사무실|화장실|출입구|계단실|주차장|식당|탈의실|흡연장|자재창고|창고)/g, "$1 $2")).replace(/\s*\(/, "<br/>(");
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
    host.innerHTML = b56Html5(b5Rows, m5);
  }
  function b56Html5(rows5, m5){
    const rows = rows5.filter(r => r.place || r.issue || r.doneBy || r.noticeNo || r.tempFacility || r.evacRoute || r.fireSupervise);
    const meta = `<table class="ch1-table b56-meta"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>점검일</th><td class="r">${b56DateKo(m5.date)}</td><th>점검자</th><td class="r">소방안전관리자 ${b56NameSig(B5_FIXED_INSPECTOR, b56SigOf(B5_FIXED_INSPECTOR))}</td></tr></table>`;
    const head = `<colgroup><col style="width:12%"><col style="width:19%"><col><col style="width:16%"><col style="width:15%"></colgroup>`
      + `<thead><tr><th rowspan="3">장소<br>(구역)</th><th rowspan="3">점검종류</th><th rowspan="3">지적사항</th><th colspan="2">현장조치 결과</th></tr><tr><th>완료</th><th>불가</th></tr><tr><th>확인자</th><th>통보서 번호</th></tr></thead>`;
    const kd = r => `<div class="b56-kd"><div><span>■ 임시소방시설</span><span>(${r.tempFacility ? " ○ " : "  "})</span></div><div><span>■ 피난로 등</span><span>(${r.evacRoute ? " ○ " : "  "})</span></div><div><span>■ 화기취급감독</span><span>(${r.fireSupervise ? " ○ " : "  "})</span></div></div>`;
    const one = r => { const n = String(r.doneBy || "").trim();
      return `<tr style="height:${b56RowMm(r)}mm"><td class="c pl">${b56Place(r.place)}</td><td>${kd(r)}</td><td>${b56IssueHtml(r)}</td><td class="done">${n ? (b56CoOf(n, rows5) ? `<div class="b56-co">${esc3a(b56CoOf(n, rows5))}</div>` : "") + b56NameSig(n, b56SigOf(n)) : ""}</td><td class="c">${esc3a(r.noticeNo || "")}</td></tr>`; };
    const BODY = 216, BLANK = 15;   // 본문 높이(mm), 빈 줄 높이
    const pages = []; let cur = [], used = 0;
    rows.forEach(r => { const h = b56RowMm(r); if(cur.length && used + h > BODY){ pages.push([cur, used]); cur = []; used = 0; } cur.push(r); used += h; });
    pages.push([cur, used]);
    return pages.map(([pr, u]) => b56PageHtml("별지 5", "안전점검 결과 지적내역서", meta,
      `<table class="ch1-table b56-t5">${head}<tbody>${pr.map(one).join("") + "<tr style=\"height:15mm\"><td></td><td></td><td></td><td></td><td></td></tr>".repeat(Math.max(0, Math.floor((BODY - u) / BLANK)))}</tbody></table>`)).join("");
  }
  function b56Pages6(){
    const host = b56Host("b56Pages6", "b6TableBody"); if(!host) return;
    let m6 = {}; try{ m6 = JSON.parse(localStorage.getItem(B6_META_KEY) || "{}"); }catch(e){}
    host.innerHTML = b56Html6(b6Rows, m6, b5Rows);
  }
  function b56Html6(rows6, m6, rows5){
    const rows = rows6.filter(r => r.place || r.kind || r.issue || r.result || r.photo || r.photoBefore);
    const meta = `<table class="ch1-table b56-meta"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>점검일</th><td class="r">${b56DateKo(m6.date)}</td><th>통보서 번호</th><td class="c">${esc3a(m6.noticeNo || "")}</td></tr></table>`;
    const head = `<colgroup><col style="width:11%"><col style="width:15%"><col style="width:33%"><col></colgroup><thead><tr><th>장소<br>(구역)</th><th>점검종류</th><th>지적사항</th><th>조치 결과 사진</th></tr></thead>`;
    const ph = u => u ? `<div class="b56-pbox"><img src="${u}" alt="" /></div>` : "";
    const kinds = r => String(r.kind || "").split(/\s*,\s*/).filter(Boolean).map(k => `<div>■\u00A0${esc3a(k)}</div>`).join("");
    const one = r => `<tr><td class="c pl">${b56Place(r.place)}</td><td><div class="b56-kd6">${kinds(r)}</div></td>`
      + `<td class="pc iss">${ph(r.photoBefore)}${b56IssueHtml(r)}</td>`
      + `<td class="pc res">${ph(r.photo)}${r.result ? `<div class="b56-txt">${esc3a(r.result)}</div>` : ""}</td></tr>`;
    const subs = String(m6.submitter || "").split(/\s*,\s*/).filter(Boolean).map(n => { const c = b56CoOf(n, rows5); return (c ? esc3a(c) + " " : "") + b56NameSig(n, b56SigOf(n)); }).join("<br/>");
    const foot = `<table class="ch1-table b56-foot"><colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col></colgroup><tr><th>제출자</th><td class="r">${subs}</td><th>확인자</th><td class="r">소방안전관리자 ${b56NameSig(B5_FIXED_INSPECTOR, b56SigOf(B5_FIXED_INSPECTOR))}</td></tr></table>`;
    return b56Chunk(rows, 2).map(pr => b56PageHtml("별지 6", "안전점검 조치 결과 통보서", meta,
      `<table class="ch1-table b56-t6">${head}<tbody>${pr.map(one).join("") + "<tr><td></td><td></td><td></td><td></td></tr>".repeat(2 - pr.length)}</tbody></table>`, foot)).join("");
  }
  function b56RecHtml(rec){
    const r = JSON.parse(JSON.stringify(rec)); b56Migrate(r);
    const r5 = r.rows5 || [], r6 = r.rows6 || [];
    return b56Html5(r5, Object.assign({ date: r.date || "" }, r.meta5 || {})) + b56Html6(r6, Object.assign({ date: r.date || "" }, r.meta6 || {}), r5);
  }
  // ---- 체크한 기록: 한 번에 인쇄 / 날짜별 PDF ----
  const b56Sel = new Set();
  function b56SelRecs(){ const k = r => b56Ymd(r.date) || "9999-99-99"; return b56Records.filter(r => b56Sel.has(r.id)).sort((a, b) => (k(a) === "9999-99-99") - (k(b) === "9999-99-99") || k(b).localeCompare(k(a)) || String(a.id || "").localeCompare(String(b.id || ""))); }   // 최근 날짜 먼저, 가장 옛날이 마지막 (빈 날짜는 맨 뒤)
  function b56SelStatus(t){ const el = document.getElementById("b56SelStatus"); if(el) el.textContent = t || ""; }
  async function b56PrintSelected(){
    const recs = b56SelRecs(); if(!recs.length){ alert("인쇄할 기록을 먼저 체크해주세요."); return; }
    const stage = document.getElementById("b3PrintStage"); if(!stage){ alert("인쇄 준비를 못 했어요."); return; }
    try{
      b56SelStatus(`⏳ ${recs.length}건을 인쇄용으로 정리하는 중이에요...`);
      stage.innerHTML = recs.map(b56RecHtml).join("");
      await b3WaitImages(stage); await b3Tick(80);
      b56SelStatus("");
      document.body.classList.add("b3-printing");
      const cleanup = ()=>{ document.body.classList.remove("b3-printing"); stage.innerHTML = ""; window.removeEventListener("afterprint", cleanup); };
      window.addEventListener("afterprint", cleanup);
      window.print();
    }catch(err){ console.error(err); b56SelStatus(""); document.body.classList.remove("b3-printing"); alert("인쇄 준비 중 문제가 생겼어요: " + (err && err.message || err)); }
  }
  async function b56PdfSelected(){
    const recs = b56SelRecs(); if(!recs.length){ alert("PDF로 저장할 기록을 먼저 체크해주세요."); return; }
    const stage = document.getElementById("b3PrintStage"); if(!stage){ alert("PDF 준비를 못 했어요."); return; }
    const btns = ["b56PrintSel", "b56PdfSel"].map(id => document.getElementById(id)); btns.forEach(b => b && (b.disabled = true));
    try{
      b56SelStatus("⏳ PDF 만드는 도구를 불러오는 중이에요...");
      await b3EnsurePdfLibs();
      const files = [], used = new Map();
      stage.classList.add("b3-offscreen");
      for(let i = 0; i < recs.length; i++){
        const rec = recs[i];
        stage.innerHTML = b56RecHtml(rec);
        await b3WaitImages(stage); await b3Tick(60);
        const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
        const nodes = [...stage.children];
        for(let k = 0; k < nodes.length; k++){
          b56SelStatus(`⏳ PDF 만드는 중... ${i + 1}/${recs.length}건 (${k + 1}/${nodes.length}쪽)`);
          const cv = await window.html2canvas(nodes[k], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
          if(k > 0) pdf.addPage();
          pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, Math.min(297, cv.height / cv.width * 210), undefined, "FAST");
        }
        const d = rec.date || "날짜없음", n = (used.get(d) || 0) + 1; used.set(d, n);
        files.push({ name: `안전점검_별지5_6_${d}${n > 1 ? "_" + n : ""}.pdf`, blob: pdf.output("blob") });
      }
      stage.classList.remove("b3-offscreen"); stage.innerHTML = "";
      if(files.length === 1) b3DownloadBlob(files[0].blob, files[0].name);
      else{
        b56SelStatus("⏳ 파일을 하나로 묶는 중이에요...");
        const zip = new window.JSZip(); files.forEach(f => zip.file(f.name, f.blob));
        b3DownloadBlob(await zip.generateAsync({ type: "blob" }), `안전점검_별지5_6_날짜별PDF_${files.length}건.zip`);
      }
      b56SelStatus(`✅ ${files.length}건을 PDF로 저장했어요.` + (files.length > 1 ? " (압축 파일 안에 날짜별 PDF가 들어 있어요)" : ""));
    }catch(err){ console.error(err); b56SelStatus(""); alert("PDF 저장 중 문제가 생겼어요: " + (err && err.message || err)); }
    finally{ stage.classList.remove("b3-offscreen"); stage.innerHTML = ""; btns.forEach(b => b && (b.disabled = false)); }
  }
  /* ---- 입력 칸: "기록 · 불러오기" / "직접 작성" 두 탭으로 (교육·훈련 화면과 같은 방식) ---- */
  (function b56Tabs(){
    const panel = document.getElementById("b56Panel"); if(!panel || document.getElementById("b56Tabs")) return;
    const rec = document.getElementById("b56RecFieldset"), pdf = document.getElementById("b5PdfFieldset"), sig = document.getElementById("b56SigFieldset");
    if(!rec || !pdf || !sig) return;
    const head = document.createElement("div");
    head.innerHTML = '<div class="b56-tabs" id="b56Tabs"><button type="button" class="b56-tab on" data-pane="b56Pane1">기록 · 불러오기</button><button type="button" class="b56-tab" data-pane="b56Pane2">직접 작성</button></div>';
    const p1 = document.createElement("div"); p1.className = "b56-pane on"; p1.id = "b56Pane1";
    const p2 = document.createElement("div"); p2.className = "b56-pane"; p2.id = "b56Pane2";
    // 지금 칸들: 맨 위 별지 5 제목·설명 → 직접 작성 탭 맨 위로
    const rest = [...panel.children].filter(e => e !== rec && e !== pdf && e !== sig);
    [pdf, rec, sig].forEach(e => p1.appendChild(e));   // 맨 먼저 하는 일(PDF 넣기)이 맨 위로
    rest.forEach(e => p2.appendChild(e));
    const note = document.createElement("p"); note.className = "save-note"; note.style.margin = "6px 0 0";
    note.textContent = '기록을 누르면 "직접 작성" 탭에서 내용을 고칠 수 있어요. 고친 뒤 여기서 "💾 수정 저장"을 누르세요.';
    rec.appendChild(note);
    while(head.firstChild) panel.appendChild(head.firstChild);
    panel.appendChild(p1); panel.appendChild(p2);
    // 직접 작성 탭 아래에도 저장 버튼 (위로 안 올라가도 되게)
    const sv = document.createElement("div"); sv.className = "b56-btns"; sv.style.marginTop = "14px";
    sv.id = "b56SaveBar";
    sv.innerHTML = '<button type="button" class="reset-btn" id="b56SaveUpd2">💾 수정 저장</button><button type="button" class="reset-btn" id="b56SaveNew2">➕ 새 기록으로 저장</button>';
    p2.appendChild(sv);
    sv.querySelector("#b56SaveUpd2").addEventListener("click", ()=>{ if(!b56CurId){ alert('열려 있는 기록이 없어요. "➕ 새 기록으로 저장"을 누르세요.'); return; } document.getElementById("b56SaveUpd").click(); });
    sv.querySelector("#b56SaveNew2").addEventListener("click", ()=> document.getElementById("b56SaveNew").click());
    window.b56ShowPane = function(id){
      document.querySelectorAll(".b56-tab").forEach(t => t.classList.toggle("on", t.dataset.pane === id));
      document.querySelectorAll(".b56-pane").forEach(x => x.classList.toggle("on", x.id === id));
    };
    document.querySelectorAll(".b56-tab").forEach(t => t.addEventListener("click", ()=> window.b56ShowPane(t.dataset.pane)));
    // 상단 바 (화기작업 화면과 같은 모양): 새로 작성 · 인쇄 · PDF · 수정 저장 · 새 기록 저장
    const view = document.getElementById("b56CombinedView");
    if(view && !document.getElementById("b56Top")){
      const I = d => `<svg class="b56-i" viewBox="0 0 24 24">${d}</svg>`;
      const top = document.createElement("header"); top.id = "b56Top";
      top.innerHTML = `<div class="b56-logo">🛠</div><div class="b56-brand"><b>안전점검 지적내역서 · 조치결과통보서</b><span>별지 5 지적내역서 · 별지 6 조치 결과 통보서 작성</span></div><div class="sp"></div>`
        + `<button class="tb" id="b56TopNew" type="button">${I('<path d="M12 5v14M5 12h14"/>')} 새로 작성</button>`
        + `<button class="tb" id="b56TopPrint" type="button">${I('<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>')} 인쇄</button>`
        + `<button class="tb" id="b56TopPdf" type="button">${I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 14h6M9 17h4"/>')} PDF</button>`
        + `<button class="tb" id="b56TopUpd" type="button" style="display:none">${I('<path d="M4 20h4l11-11-4-4L4 16z"/>')} 수정 저장</button>`
        + `<button class="tb pri" id="b56TopSave" type="button">${I('<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>')} 새 기록 저장</button>`;
      view.insertBefore(top, view.firstChild);
      document.getElementById("b56TopNew").addEventListener("click", ()=> document.getElementById("b56New").click());
      document.getElementById("b56TopPrint").addEventListener("click", ()=> window.print());
      document.getElementById("b56TopUpd").addEventListener("click", ()=> document.getElementById("b56SaveUpd").click());
      document.getElementById("b56TopSave").addEventListener("click", ()=> document.getElementById("b56SaveNew").click());
      document.getElementById("b56TopPdf").addEventListener("click", async (e)=>{
        const btn = e.currentTarget, pages = [...document.querySelectorAll("#b56Main .b56-page")]; if(!pages.length) return;
        const old = btn.innerHTML; btn.disabled = true; btn.textContent = "⏳ PDF 만드는 중...";
        try{
          await b3EnsurePdfLibs();
          const { jsPDF } = window.jspdf; const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
          for(let k = 0; k < pages.length; k++){
            btn.textContent = `⏳ PDF ${k + 1}/${pages.length}쪽`;
            const cv = await window.html2canvas(pages[k], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false });
            if(k > 0) pdf.addPage();
            pdf.addImage(cv.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, Math.min(297, cv.height / cv.width * 210), undefined, "FAST");
          }
          const d = b56Meta(B5_META_KEY).date || "날짜없음";
          b3DownloadBlob(pdf.output("blob"), `안전점검_별지5·6_${d}.pdf`);
        }catch(err){ console.error(err); alert("PDF 저장 중 문제가 생겼어요: " + (err && err.message || err)); }
        finally{ btn.disabled = false; btn.innerHTML = old; }
      });
      b56RenderRecs();
    }
    // 별지 6 확인자 = 소방안전관리자(점검자와 같은 사람)로 고정
    const cf = document.getElementById("b6-confirmer"); if(cf){ cf.value = B5_FIXED_INSPECTOR; cf.readOnly = true; cf.title = "소방안전관리자로 고정돼요"; }
    ["b6-submitter", "b6-confirmer"].forEach(id => { const el = document.getElementById(id); if(el) el.addEventListener("change", ()=>{ try{ b56RenderSigs(); }catch(e){} }); });
  })();
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
     '''        <div class="field"><label>완료(확인자 = 안전 서류의 조치자)</label><input type="text" data-f="doneBy" value="${esc(r.doneBy)}" placeholder="미조치면 비워 두세요" /></div>'''),
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

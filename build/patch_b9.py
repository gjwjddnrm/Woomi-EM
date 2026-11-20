# 안전점검 화면에 "별지 9 소방시설 오동작 관리대장" 추가
# - 안전팀 "추가위험발굴지시/조치" PDF에서 오동작 항목(비상경보장치 오경보·경보 불량, 가스누설경보기 오작동,
#   비상조명등 미점등·배터리 불량, 자동화재탐지설비 비화재보, 스프링클러 헤드 파손 방수 등)을 골라
#   그 지시일자 기록의 마지막 장(별지 9)에 넣음. 소화기·방화포·간이피난유도선은 오동작이 아니므로 넣지 않음
# - 양식은 원본 별지 9 그대로(쪽 번호 없음), 사진 없음
# - 직접 작성 탭에서 줄을 고치거나 더할 수 있음, 날짜별 기록·인쇄·PDF에 함께 들어감

B9_JS = r'''
  /* ================= 별지 9: 소방시설 오동작 관리대장 (안전점검 기록의 마지막 장) ================= */
  const B9_BLANK = ()=> ({ kind:"", date:"", content:"", result:"", confirmer:"" });
  function b9Clean(rows){ return (rows || []).filter(r => r && (String(r.kind || "").trim() || String(r.date || "").trim() || String(r.content || "").trim() || String(r.result || "").trim())).map(r => Object.assign({}, r)); }
  // 오동작 찾기: 시설 + 오동작 낱말이 함께 있을 때만. 소화기·방화포·간이피난유도선은 오동작이 아님(훼손·분실은 점검 지적)
  const B9_SYS = [
    ["비상경보장치", /비상\s*경보|발신기|경종|비상\s*벨/],
    ["가스누설경보기", /가스\s*(누설|감지|경보)/],
    ["비상조명등", /비상\s*조명|비상등|조명등/],
    ["유도등", /(?<!간이피난)유도등/],
    ["자동화재탐지설비", /자동\s*화재\s*탐지|자탐|감지기|수신기|비화재보/],
    ["스프링클러설비", /스프링\s*클러|SP\s*헤드|헤드\s*(파손|방수|누수)/],
    ["옥내소화전설비", /옥내\s*소화전|소화전/],
  ];
  const B9_BAD = /오작동|오동작|오경보|비화재보|작동\s*(불가|불량|안\s*됨|하지\s*않)|미작동|미점등|점등\s*(불량|안)|경보\s*불량|배터리|고장|불량|방수|누수|파손/;
  function b9Detect(r){
    const t = [r.trade, r.issue, r.result].map(v => String(v || "")).join(" ");
    if(!B9_BAD.test(t)) return null;
    const hit = B9_SYS.find(([, re]) => re.test(t));
    return hit ? hit[0] : null;
  }
  function b9FromImport(r){
    const iss = String(r.issue || "").split(/\n?▶\s*조치요청:/)[0].trim().replace(/\s+/g, " ");
    const lines = String(r.result || "").split("\n");
    const act = lines.slice(1).join(" ").trim().replace(/\s+/g, " ");
    const dd = r._doneDate ? String(r._doneDate).replace(/-/g, ".") : "";
    const done = /^조치\s*완료/.test(lines[0] || "");
    const result = done ? ((act || "조치 완료") + (dd ? ` (${dd})` : "")) : (lines[0] || "미조치");
    return { kind: r._b9kind || b9Detect(r) || "", date: r._date || "", content: [String(r.place || "").trim(), iss].filter(Boolean).join(" : "),
      result, confirmer: B5_FIXED_INSPECTOR, docNo: r.docNo || "" };
  }
  // 인쇄용 쪽: 원본 별지 9 서식 그대로 (가운데 "소방시설 오동작 관리대장" 띠 + 다섯 칸), 쪽 번호 없음
  function b9RowMm(r){
    const ln = (t, cpl) => String(t || "").split(/\n/).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / cpl)), 0);
    return Math.max(9.5, Math.max(ln(r.kind, 8), ln(r.content, 30), ln(r.result, 8), 1) * 4.3 + 2.4);
  }
  function b56Html9(rows9){
    const rows = b9Clean(rows9);
    if(!rows.length) return "";
    const BODY = 222, BLANK = 9.5;
    const head = `<colgroup><col style="width:16%"><col style="width:12%"><col><col style="width:14%"><col style="width:12%"></colgroup>`
      + `<thead><tr><th colspan="5" class="b9-band">소방시설 오동작 관리대장</th></tr><tr><th>소방시설 구분</th><th>일 자</th><th>오동작내용</th><th>조치결과</th><th>확인자</th></tr></thead>`;
    const one = r => { const who = String(r.confirmer || B5_FIXED_INSPECTOR || "").trim();
      return `<tr style="height:${b9RowMm(r)}mm"><td class="c">${esc3a(r.kind || "")}</td><td class="c">${esc3a(String(r.date || "").replace(/-/g, "."))}</td><td class="l">${esc3a(r.content || "")}</td><td class="c">${esc3a(r.result || "")}</td><td class="c">${who ? b56NameSig(who, b56SigOf(who)) : ""}</td></tr>`; };
    const pages = []; let cur = [], used = 0;
    rows.forEach(r => { const h = b9RowMm(r); if(cur.length && used + h > BODY){ pages.push([cur, used]); cur = []; used = 0; } cur.push(r); used += h; });
    pages.push([cur, used]);
    const blank = `<tr style="height:${BLANK}mm"><td></td><td></td><td></td><td></td><td></td></tr>`;
    return pages.map(([pr, u]) => b56PageHtml("별지 9", "소방시설 오동작 관리대장", "",
      `<table class="ch1-table b56-t9">${head}<tbody>${pr.map(one).join("") + blank.repeat(Math.max(0, Math.floor((BODY - u) / BLANK)))}</tbody></table>`)).join("");
  }
  function b56Pages9(){
    const main = document.getElementById("b56Main"); if(!main) return;
    let h = document.getElementById("b56Pages9");
    if(!h){ h = document.createElement("div"); h.id = "b56Pages9"; h.className = "b56-pages"; }
    const after = document.getElementById("b56Pages6");
    if(after && after.nextSibling !== h) after.parentNode.insertBefore(h, after.nextSibling); else if(!h.parentNode) main.appendChild(h);
    h.innerHTML = b56Html9(b9Rows);
  }
  (function setupB9(){
    const p2 = document.getElementById("b56Pane2"), box = document.getElementById("b9RowsContainer");
    if(!p2 || !box) return;
    const fs = document.createElement("fieldset"); fs.id = "b9Fieldset";
    fs.innerHTML = '<legend>🚨 별지 9 · 소방시설 오동작 관리대장</legend><p class="save-note" style="margin-top:0">PDF를 불러오면 오동작(비상경보장치 오경보·경보 불량, 가스누설경보기 오작동, 비상조명등 미점등, 자동화재탐지설비 비화재보, 스프링클러 헤드 파손 방수 등)이 자동으로 들어가요. 소화기·방화포·간이피난유도선은 넣지 않아요. 줄이 하나라도 있으면 이 날짜 기록의 마지막 장에 붙어요.</p>';
    fs.appendChild(box);
    ["b9AddBtn", "b9ResetBtn"].forEach(id => { const b = document.getElementById(id); if(b) fs.appendChild(b); });
    const bar = document.getElementById("b56SaveBar");
    if(bar) p2.insertBefore(fs, bar); else p2.appendChild(fs);
    if(!b9Clean(b9Rows).length){ b9Rows = [B9_BLANK()]; }
    b56Pages9();
  })();
'''

B9_CSS = """
  .b56-page .b56-t9{ height:auto; }
  .b56-page .b56-t9 th{ background:#dce6f2; font-weight:700; font-size:12px; padding:2mm 1mm; }
  .b56-page .b56-t9 th.b9-band{ font-size:14px; letter-spacing:1px; padding:2.4mm 1mm; }
  .b56-page .b56-t9 td{ font-size:11px; line-height:1.35; padding:1mm 1.5mm; vertical-align:middle; word-break:keep-all; overflow-wrap:break-word; }
  .b56-page .b56-t9 td.c{ text-align:center; }
  .b56-page .b56-t9 td.l{ text-align:left; }
  .b56-page .b56-t9 td .b56-sn{ flex-wrap:wrap; justify-content:center; white-space:normal; }
  @media print{ #b56Pages9 > .b56-page:first-child{ break-before:page; page-break-before:always; } }
"""

REVIEW_B9 = r'''
        ${(()=>{ if(r._b9kind === undefined) r._b9kind = b9Detect(r) || ""; return r._b9kind ? `<div class="field b9-rev"><label><input type="checkbox" data-f="b9on" ${r.b9on !== false ? "checked" : ""}/> 🚨 오동작 관리대장(별지 9)에 넣기 · <b>${esc(r._b9kind)}</b></label></div>` : ""; })()}'''

PAIRS = [
    # 기록 = 별지 5 · 6 · 9
    ('    return { date: m5.date || m6.date || "", rows5: JSON.parse(JSON.stringify(b5Rows)), rows6: JSON.parse(JSON.stringify(b6Rows)), meta5: m5, meta6: m6 };',
     '    return { date: m5.date || m6.date || "", rows5: JSON.parse(JSON.stringify(b5Rows)), rows6: JSON.parse(JSON.stringify(b6Rows)), meta5: m5, meta6: m6, rows9: b9Clean(b9Rows) };'),
    ('    saveB5Rows(); saveB6Rows(); loadB5Meta(); loadB6Meta(); renderB5Form(); renderB6Form(); b56RenderSigs();',
     '    b9Rows = b9Clean(rec.rows9); if(!b9Rows.length) b9Rows = [B9_BLANK()];   // 별지 9\n'
     '    saveB5Rows(); saveB6Rows(); saveB9Rows(); loadB5Meta(); loadB6Meta(); renderB5Form(); renderB6Form(); renderB9Form(); b56RenderSigs();'),
    ('    return b56Html5(r5, Object.assign({ date: r.date || "" }, r.meta5 || {})) + b56Html6(r6, Object.assign({ date: r.date || "" }, r.meta6 || {}), r5);',
     '    return b56Html5(r5, Object.assign({ date: r.date || "" }, r.meta5 || {})) + b56Html6(r6, Object.assign({ date: r.date || "" }, r.meta6 || {}), r5) + b56Html9(r.rows9);'),
    # 미리보기: 별지 9 줄을 고치면 인쇄용 쪽도
    ('  function renderB9Preview(){\n', '  function renderB9Preview(){\n    try{ b56Pages9(); }catch(e){}\n'),
    # 새 줄의 확인자 = 로그인한 관리자
    ('    b9Rows.push({kind:"",date:"",content:"",result:"",confirmer:""});',
     '    b9Rows.push({kind:"",date:"",content:"",result:"",confirmer:(typeof B5_FIXED_INSPECTOR !== "undefined" ? B5_FIXED_INSPECTOR : "")});'),
    # PDF 불러오기: 오동작만 있는 날짜도 기록을 만들고, 날짜별 기록에 별지 9 줄을 문서번호로 합침
    ('    const dates = [...groups.keys()].sort();\n    let made = 0, merged = 0, last = null;',
     '    b5ImportRows.forEach(r => { if(r._b9kind === undefined) r._b9kind = b9Detect(r) || ""; if(r._b9kind && r.b9on !== false && !groups.has(r._date || "")) groups.set(r._date || "", []); });\n'
     '    const dates = [...groups.keys()].sort();\n    let made = 0, merged = 0, last = null, b9n = 0;'),
    ('      last = rec;\n    });\n    b56Renumber();',
     '      { const add = b5ImportRows.filter(r => (r._date || "") === date && r._b9kind && r.b9on !== false).map(b9FromImport);   // 별지 9\n'
     '        rec.rows9 = b9Clean(rec.rows9); add.forEach(n => { const ex = n.docNo && rec.rows9.find(x => x.docNo === n.docNo); if(ex) Object.assign(ex, n); else rec.rows9.push(n); b9n++; }); }\n'
     '      last = rec;\n    });\n    b56Renumber();'),
    ('    alert(`지시일자별로 ${dates.length}일치 기록을 저장했어요${merged ? ` (새 기록 ${made}개, 같은 날짜 기록에 합친 것 ${merged}개)` : ""}.',
     '    alert(`지시일자별로 ${dates.length}일치 기록을 저장했어요${merged ? ` (새 기록 ${made}개, 같은 날짜 기록에 합친 것 ${merged}개)` : ""}.${b9n ? `\\n🚨 소방시설 오동작 ${b9n}건은 그 날짜 기록 마지막 장(별지 9 오동작 관리대장)에 넣었어요.` : ""}'),
    # 검토 화면: 오동작이면 별지 9에 넣을지 체크
    ('        <div class="field"><label>조치 결과 (별지 6)</label><textarea data-f="result" rows="2">${esc(r.result)}</textarea></div>',
     '        <div class="field"><label>조치 결과 (별지 6)</label><textarea data-f="result" rows="2">${esc(r.result)}</textarea></div>' + REVIEW_B9),
    # 코드·스타일
    ('  load();\n  wireHomeCoverInputs();', B9_JS + '  load();\n  wireHomeCoverInputs();'),
    ('  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }',
     B9_CSS + '  #b3aSaveLogBtn{ background:var(--navy); color:#fff; border-color:var(--navy); }'),
]
